import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  rpcUrl: process.env.BSC_RPC_URL?.trim() || "https://bsc-dataseed.binance.org/",
  dexScreenerApiUrl:
    process.env.DEXSCREENER_API_URL?.trim() ||
    "https://api.dexscreener.com/latest/dex/tokens",
  pollIntervalMs: Math.max(1000, Number(process.env.POLL_INTERVAL_MS || 4000)),
  dataFile: process.env.DATA_FILE?.trim() || "./data/buybot.json",
  superAdminIds: new Set(
    (process.env.SUPER_ADMIN_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
};