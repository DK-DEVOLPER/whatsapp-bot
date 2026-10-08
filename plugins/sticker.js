export default {
  name: "sticker",
  description: "Envía una imagen como sticker",
  commands: ["sticker", "s"],
  async execute({ sock, msg, jid, reply }) {
    const type = Object.keys(msg.message)[0];
    const img =
      msg.message.imageMessage ||
      msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!img) {
      return reply({ text: "Envía o responde a una imagen con el comando." });
    }

    try {
      const buffer = await sock.downloadMediaMessage(
        msg.message.extendedTextMessage?.contextInfo?.quotedMessage
          ? { key: msg.key, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
          : msg,
        "buffer",
        {},
        { logger: { level: "silent" }, reuploadRequest: sock.updateMediaMessage }
      );
      await sock.sendMessage(jid, { sticker: buffer });
    } catch (err) {
      await reply({ text: `⚠️ Error: ${err.message}` });
    }
  },
};
