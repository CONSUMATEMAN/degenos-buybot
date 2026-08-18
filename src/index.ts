import { config } from "./config.js";
import { createBot } from "./bot.js";
import { loadStore } from "./store.js";
import { BuyMonitor } from "./services/monitor.js";

async function main(): Promise<void> {
  console.log("🟢 Starting DegenOS BuyBot...");

  const store = loadStore();
  const bot = createBot(store);
  const monitor = new BuyMonitor(store, bot);

  await bot.telegram.setMyCommands([
    { command: "start", description: "Start DegenOS BuyBot" },
    { command: "help", description: "Show help" },
    { command: "add", description: "Add a token to this group" },
    { command: "remove", description: "Remove the token" },
    { command: "settings", description: "Open BuyBot settings" },
    { command: "status", description: "Show current token" },
    { command: "minbuy", description: "Set minimum buy USD" }
  ]);

  await bot.launch();
  await monitor.start();

  console.log("🐸 DegenOS BuyBot is running.");

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}. Shutting down...`);
    monitor.stop();
    bot.stop(signal);
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});