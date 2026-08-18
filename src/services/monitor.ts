import type { Telegraf } from "telegraf";
import type { Store, TokenConfig } from "../types/index.js";
import {
  getProvider,
  scanPair,
  getBnbUsdPrice
} from "./blockchain.js";
import { config } from "../config.js";
import { saveStore } from "../store.js";

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function tokenNumber(value: string): string {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return value;
  }

  return n.toLocaleString("en-US", {
    maximumFractionDigits: 4
  });
}

function explorerTx(tx: string): string {
  return `https://bscscan.com/tx/${tx}`;
}

function chartUrl(token: TokenConfig): string {
  return `https://dexscreener.com/bsc/${token.pair}`;
}

function buyUrl(token: TokenConfig): string {
  return `https://pancakeswap.finance/swap?outputCurrency=${token.contract}`;
}

function communityUrl(link: string): string {
  return link.trim();
}

function renderBuy(
  token: TokenConfig,
  communityLink: string | undefined,
  buy: {
    buyer: string;
    bnbAmountFormatted: string;
    tokenAmountFormatted: string;
    usdValue: number;
    txHash: string;
  },
  count: number
): string {
  const whale =
    buy.usdValue >= 1000
      ? "🐋 WHALE BUY"
      : "🟢 NEW BUY";

  const lines = [
    `${token.buyEmoji} *${whale}*`,
    "",
    `💰 *${Number(buy.bnbAmountFormatted).toFixed(4)} BNB*`,
    `💵 *${money(buy.usdValue)}*`,
    `🪙 *${tokenNumber(buy.tokenAmountFormatted)} ${token.symbol}*`,
    "",
    `🔢 Buy #${count}`,
    `👤 Buyer: \`${shortAddress(buy.buyer)}\``,
    ""
  ];

  if (communityLink) {
    lines.push(`🔗 [COMMUNITY / PORTAL](${communityUrl(communityLink)})`);
    lines.push("");
  }

  lines.push(
    `🔗 [TX](${explorerTx(buy.txHash)})  |  [CHART](${chartUrl(token)})  |  [BUY](${buyUrl(token)})`
  );

  return lines.join("\n");
}

export class BuyMonitor {
  private running = false;
  private lastBlock = 0;

  constructor(
    private readonly store: Store,
    private readonly bot: Telegraf
  ) {}

  stop(): void {
    this.running = false;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    this.lastBlock = await getProvider().getBlockNumber();

    console.log(
      `🟢 Buy monitor started at block ${this.lastBlock}`
    );

    void this.loop();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const currentBlock =
          await getProvider().getBlockNumber();

        if (currentBlock > this.lastBlock) {
          const fromBlock = this.lastBlock + 1;
          const toBlock = currentBlock;

          for (const group of Object.values(
            this.store.groups
          )) {
            if (!group.token?.enabled) {
              continue;
            }

            try {
              const buys = await scanPair(
                group.token,
                fromBlock,
                toBlock
              );

              if (!buys.length) {
                continue;
              }

              let bnbUsd = 0;

              try {
                bnbUsd = await getBnbUsdPrice();
              } catch (error) {
                console.error(
                  "BNB price error:",
                  error
                );
              }

              for (const buy of buys) {
                buy.usdValue =
                  bnbUsd > 0
                    ? Number(
                        buy.bnbAmountFormatted
                      ) * bnbUsd
                    : 0;

                if (
                  buy.usdValue <
                  group.token.minimumBuyUsd
                ) {
                  continue;
                }

                group.token.buyCount += 1;

                const message = renderBuy(
                  group.token,
                  group.communityLink,
                  buy,
                  group.token.buyCount
                );

                await this.bot.telegram.sendMessage(
                  group.chatId,
                  message,
                  {
                    parse_mode: "Markdown",
                    link_preview_options: {
                      is_disabled: true
                    }
                  }
                );
              }

              saveStore(this.store);
            } catch (error) {
              console.error(
                `Monitor error for ${group.token.symbol} in ${group.chatId}:`,
                error
              );
            }
          }

          this.lastBlock = currentBlock;
        }
      } catch (error) {
        console.error(
          "Buy monitor loop error:",
          error
        );
      }

      await new Promise((resolve) =>
        setTimeout(
          resolve,
          config.pollIntervalMs
        )
      );
    }
  }
}