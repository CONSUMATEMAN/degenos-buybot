import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import type {
  Store,
  GroupConfig,
  TokenConfig
} from "./types/index.js";

const emptyStore: Store = {
  groups: {}
};

function ensureFile(): void {
  const dir = path.dirname(config.dataFile);

  fs.mkdirSync(dir, {
    recursive: true
  });

  if (!fs.existsSync(config.dataFile)) {
    fs.writeFileSync(
      config.dataFile,
      JSON.stringify(emptyStore, null, 2)
    );
  }
}

function normalizeToken(token: TokenConfig): TokenConfig {
  return {
    contract: token.contract,
    symbol: token.symbol,
    name: token.name,
    decimals: Number(token.decimals ?? 18),
    pair: token.pair,
    tokenIs0: Boolean(token.tokenIs0),

    minimumBuyUsd: Number(token.minimumBuyUsd ?? 10),
    buyStepUsd: Number(token.buyStepUsd ?? 1),
    buyEmoji: token.buyEmoji || "🟢",

    enabled: token.enabled !== false,
    buyCount: Number(token.buyCount ?? 0),

    // BuyBot display
    buyMediaUrl: token.buyMediaUrl,
    buyMediaType: token.buyMediaType,

    // Competition
    competitionEnabled: token.competitionEnabled ?? false,
    competitionStartedAt: token.competitionStartedAt,
    competitionEndsAt: token.competitionEndsAt,

    // Trending
    trendingFastTrack: token.trendingFastTrack ?? false,

    // Premium
    premiumAdFree: token.premiumAdFree ?? false
  };
}

function normalizeGroup(group: GroupConfig): GroupConfig {
  return {
    chatId: group.chatId,
    token: group.token
      ? normalizeToken(group.token)
      : undefined,
    communityLink: group.communityLink
  };
}

export function loadStore(): Store {
  ensureFile();

  try {
    const raw = fs.readFileSync(
      config.dataFile,
      "utf8"
    );

    const parsed = JSON.parse(raw) as Partial<Store>;

    if (
      !parsed.groups ||
      typeof parsed.groups !== "object"
    ) {
      return structuredClone(emptyStore);
    }

    const groups: Record<string, GroupConfig> = {};

    for (const [id, group] of Object.entries(
      parsed.groups
    )) {
      if (!group || typeof group !== "object") {
        continue;
      }

      groups[id] = normalizeGroup({
        ...group,
        chatId: group.chatId || id
      });
    }

    return {
      groups
    };
  } catch (error) {
    console.error(
      "Could not load BuyBot store:",
      error
    );

    return structuredClone(emptyStore);
  }
}

export function saveStore(store: Store): void {
  ensureFile();

  const temp = `${config.dataFile}.tmp`;

  fs.writeFileSync(
    temp,
    JSON.stringify(store, null, 2)
  );

  fs.renameSync(
    temp,
    config.dataFile
  );
}

export function getGroup(
  store: Store,
  chatId: string
): GroupConfig {
  if (!store.groups[chatId]) {
    store.groups[chatId] = {
      chatId
    };

    saveStore(store);
  }

  return store.groups[chatId];
}