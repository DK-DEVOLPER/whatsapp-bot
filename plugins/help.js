export default {
  name: "help",
  description: "Muestra todos los comandos disponibles",
  commands: ["help", "ayuda", "?"],
  async execute({ reply, config, plugins }) {
    const lines = ["*📋 COMANDOS DISPONIBLES*", ""];
    for (const plugin of plugins.values()) {
      const cmds = plugin.commands.map((c) => `${config.prefix}${c}`).join(", ");
      lines.push(`${cmds}`);
      if (plugin.description) lines.push(`   _${plugin.description}_`);
      lines.push("");
    }
    lines.push(`Prefijo actual: ${config.prefix}`);
    await reply({ text: lines.join("\n") });
  },
};
