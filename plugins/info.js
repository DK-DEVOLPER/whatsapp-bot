export default {
  name: "info",
  description: "Información del bot",
  commands: ["info", "bot"],
  async execute({ reply, sock, config, plugins }) {
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    const lines = [
      "*🤖 INFORMACIÓN DEL BOT*",
      "",
      ` Nombre: ${sock.user?.name || "Bot"}`,
      ` Plugins: ${plugins.size}`,
      ` Prefijo: ${config.prefix}`,
      ` Uptime: ${h}h ${m}m ${s}s`,
      ` Memoria: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
    ];
    await reply({ text: lines.join("\n") });
  },
};
