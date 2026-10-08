import { startBot, stopBot } from "./connection.js";

process.on("SIGINT", () => {
  console.log("\n[bot] Deteniendo...");
  stopBot();
  process.exit(0);
});

process.on("uncaughtException", (err) => {
  console.error("[bot] Excepción no capturada:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("[bot] Promesa rechazada:", err);
});

startBot().catch((err) => {
  console.error("[bot] Error fatal:", err);
  process.exit(1);
});
