import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { loadAuthState } from "./auth.js";
import { config } from "./config.js";
import { getPlugins, findPlugin, loadAllPlugins, watchPlugins } from "./pluginLoader.js";

let sock = null;
let retryCount = 0;
let reconnectTimer = null;
let isConnecting = false;
let pairingRequested = false;
let lastMessageTimes = new Map();

export function getSock() {
  return sock;
}

function calculateDelay() {
  const delay = Math.min(
    config.reconnect.baseDelay * 2 ** retryCount,
    config.reconnect.maxDelay
  );
  return delay + Math.floor(Math.random() * 1000);
}

function scheduleReconnect(reason) {
  if (retryCount >= config.reconnect.maxRetries) {
    console.error(`[conn] Máximo de reintentos alcanzado (${config.reconnect.maxRetries}). Deteniendo.`);
    return;
  }

  const delay = calculateDelay();
  retryCount++;
  console.log(`[conn] Reconectando en ${delay}ms (intento ${retryCount}/${config.reconnect.maxRetries}) - ${reason}`);

  reconnectTimer = setTimeout(() => {
    startConnection();
  }, delay);
}

async function requestPairingCode() {
  if (!config.phoneNumber) {
    console.error(
      "\n[pairing] PHONE_NUMBER no configurado.\n" +
        "Agrega PHONE_NUMBER=54911... (con código de país, sin +) a tu archivo .env\n" +
        "Luego ejecuta: npm run pair\n"
    );
    return;
  }

  if (!sock || pairingRequested) return;
  pairingRequested = true;

  try {
    const code = await sock.requestPairingCode(config.phoneNumber);
    const formatted = code.match(/.{1,4}/g)?.join("-") ?? code;
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║      CÓDIGO DE EMPAREJAMIENTO        ║");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║          ${formatted.padEnd(28)}║`);
    console.log("╚══════════════════════════════════════╝");
    console.log("WhatsApp > Dispositivos vinculados > Vincular dispositivo\n");
  } catch (err) {
    pairingRequested = false;
    console.error("[pairing] Error solicitando código:", err.message);
  }
}

async function handleMessage(msg) {
  if (!msg.message || msg.key.fromMe) return;

  const jid = msg.key.remoteJid;
  if (jid === "status@broadcast") return;

  const type = Object.keys(msg.message)[0];
  if (type === "protocolMessage" || type === "reactionMessage") return;

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    msg.message.videoMessage?.caption ||
    "";

  if (!text.startsWith(config.prefix)) return;

  const [rawCommand, ...args] = text.slice(config.prefix.length).trim().split(/\s+/);
  const command = rawCommand.toLowerCase();
  if (!command) return;

  const now = Date.now();
  const last = lastMessageTimes.get(jid) || 0;
  if (now - last < 1000) return;
  lastMessageTimes.set(jid, now);

  const plugin = findPlugin(command);
  if (!plugin) return;

  try {
    await plugin.execute({
      sock,
      msg,
      jid,
      args,
      text: text.slice(config.prefix.length + command.length).trim(),
      command,
      config,
      plugins: getPlugins(),
      reply: async (content, options = {}) => {
        return sock.sendMessage(jid, content, { quoted: msg, ...options });
      },
    });
  } catch (err) {
    console.error(`[plugin] Error en "${command}":`, err);
    try {
      await sock.sendMessage(jid, { text: `⚠️ Error ejecutando el comando.` }, { quoted: msg });
    } catch {}
  }
}

async function startConnection() {
  if (isConnecting) return;
  isConnecting = true;
  clearTimeout(reconnectTimer);

  try {
    const { state, saveCreds } = await loadAuthState();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, {
          trace: () => {},
          level: "silent",
        }),
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "120.0.0"],
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !config.phoneNumber && !pairingRequested) {
        console.log("[conn] Escanea este QR con WhatsApp:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "connecting") {
        console.log("[conn] Conectando...");
        if (!state.creds.registered && config.phoneNumber && !pairingRequested) {
          setTimeout(() => requestPairingCode(), 3000);
        }
      }

      if (connection === "open") {
        console.log("[conn] ✅ Conectado como:", sock.user?.id);
        retryCount = 0;
        pairingRequested = false;
        isConnecting = false;
      }

      if (connection === "close") {
        isConnecting = false;
        if (!state.creds.registered) pairingRequested = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || `code:${statusCode}`;

        console.log(`[conn] Conexión cerrada: ${reason}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.error("[conn] Sesión cerrada. Elimina la carpeta de sesión y vuelve a emparejar.");
          pairingRequested = false;
          return;
        }

        if (statusCode === DisconnectReason.badSession) {
          console.error("[conn] Sesión corrupta. Elimina la carpeta de sesión.");
          pairingRequested = false;
          return;
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          console.error("[conn] Otra sesión tomó el lugar. Esperando 5s...");
          reconnectTimer = setTimeout(() => startConnection(), 5000);
          return;
        }

        scheduleReconnect(reason);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        await handleMessage(msg).catch((err) =>
          console.error("[msg] Error procesando mensaje:", err.message)
        );
      }
    });
  } catch (err) {
    isConnecting = false;
    console.error("[conn] Error al iniciar conexión:", err.message);
    scheduleReconnect(err.message);
  }
}

export async function startBot() {
  console.log("[bot] Iniciando...");
  await loadAllPlugins();
  watchPlugins();
  await startConnection();
}

export function stopBot() {
  clearTimeout(reconnectTimer);
  if (sock) sock.end?.();
}
