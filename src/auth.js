import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { config } from "./config.js";

export async function loadAuthState() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
  return { state, saveCreds };
}
