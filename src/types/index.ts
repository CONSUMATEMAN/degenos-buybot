export interface TokenConfig {
  contract: string;
  symbol: string;
  name: string;
  decimals: number;
  pair: string;
  tokenIs0: boolean;

  minimumBuyUsd: number;
  buyStepUsd: number;
  buyEmoji: string;

  enabled: boolean;
  buyCount: number;

  // BuyBot display
  buyMediaUrl?: string;
  buyMediaType?: "photo" | "animation";

  // Buy competition
  competitionEnabled?: boolean;
  competitionStartedAt?: number;
  competitionEndsAt?: number;

  // Trending
  trendingFastTrack?: boolean;

  // Premium
  premiumAdFree?: boolean;
}

export interface GroupConfig {
  chatId: string;
  token?: TokenConfig;

  // Group / Channel / Community / Portal link
  communityLink?: string;
}

export interface Store {
  groups: Record<string, GroupConfig>;
}