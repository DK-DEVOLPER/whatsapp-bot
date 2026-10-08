export default {
  name: "ping",
  description: "Verifica que el bot esté activo",
  commands: ["ping", "p"],
  async execute({ reply }) {
    const start = Date.now();
    const sent = await reply({ text: "🏓 Pong!" });
    const latency = Date.now() - start;
    await reply({ text: `⚡ Latencia: ${latency}ms` });
  },
};
