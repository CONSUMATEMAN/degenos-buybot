import { Contract, JsonRpcProvider, formatUnits, isAddress } from "ethers";
import { config } from "../config.js";
import {
  ERC20_ABI,
  FACTORY_ABI,
  PAIR_ABI,
  PANCAKE_V2_FACTORY,
  PAIR_ABI as _PAIR_ABI,
  WBNB,
  SWAP_ABI
} from "../abis.js";
import type { TokenConfig } from "../types/index.js";

export interface BuyEvent {
  txHash: string;
  buyer: string;
  bnbAmount: bigint;
  tokenAmount: bigint;
  bnbAmountFormatted: string;
  tokenAmountFormatted: string;
  usdValue: number;
  blockNumber: number;
}

const provider = new JsonRpcProvider(config.rpcUrl);
provider.pollingInterval = config.pollIntervalMs;

const factory = new Contract(PANCAKE_V2_FACTORY, FACTORY_ABI, provider);

export function getProvider(): JsonRpcProvider {
  return provider;
}

export async function buildTokenConfig(contractAddress: string): Promise<TokenConfig> {
  if (!isAddress(contractAddress)) {
    throw new Error("That is not a valid EVM contract address.");
  }

  const contract = new Contract(contractAddress, ERC20_ABI, provider);

  const [symbol, name, decimals, pair] = await Promise.all([
    contract.symbol() as Promise<string>,
    contract.name() as Promise<string>,
    contract.decimals() as Promise<number>,
    factory.getPair(contractAddress, WBNB) as Promise<string>
  ]);

  if (!pair || pair === "0x0000000000000000000000000000000000000000") {
    throw new Error("No PancakeSwap V2 WBNB pair was found for this token.");
  }

  const pairContract = new Contract(pair, PAIR_ABI, provider);
  const [token0, token1] = await Promise.all([
    pairContract.token0() as Promise<string>,
    pairContract.token1() as Promise<string>
  ]);

  const normalizedToken = contractAddress.toLowerCase();
  const tokenIs0 = token0.toLowerCase() === normalizedToken;
  const tokenIs1 = token1.toLowerCase() === normalizedToken;

  if (!tokenIs0 && !tokenIs1) {
    throw new Error("The discovered pair does not contain the configured token.");
  }

  return {
    contract: contractAddress,
    symbol,
    name,
    decimals: Number(decimals),
    pair,
    tokenIs0,
    minimumBuyUsd: 10,
    buyStepUsd: 1,
    buyEmoji: "🟢",
    enabled: true,
    buyCount: 0
  };
}

export function isBuy(
  token: TokenConfig,
  amount0In: bigint,
  amount1In: bigint,
  amount0Out: bigint,
  amount1Out: bigint
): boolean {
  if (token.tokenIs0) {
    return amount1In > 0n && amount0Out > 0n;
  }

  return amount0In > 0n && amount1Out > 0n;
}

export function decodeBuy(
  token: TokenConfig,
  args: readonly unknown[],
  txHash: string,
  blockNumber: number
): BuyEvent | null {
  const amount0In = BigInt(args[1] as bigint);
  const amount1In = BigInt(args[2] as bigint);
  const amount0Out = BigInt(args[3] as bigint);
  const amount1Out = BigInt(args[4] as bigint);
  const buyer = String(args[5]);

  if (!isBuy(token, amount0In, amount1In, amount0Out, amount1Out)) {
    return null;
  }

  const bnbAmount = token.tokenIs0 ? amount1In : amount0In;
  const tokenAmount = token.tokenIs0 ? amount0Out : amount1Out;

  return {
    txHash,
    buyer,
    bnbAmount,
    tokenAmount,
    bnbAmountFormatted: formatUnits(bnbAmount, 18),
    tokenAmountFormatted: formatUnits(tokenAmount, token.decimals),
    usdValue: 0,
    blockNumber
  };
}

export async function getBnbUsdPrice(): Promise<number> {
  const response = await fetch(
    `${config.dexScreenerApiUrl}/${WBNB}`
  );

  if (!response.ok) {
    throw new Error(`DexScreener HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    pairs?: Array<{ priceUsd?: string | null }>;
  };

  const prices = (data.pairs || [])
    .map((pair) => Number(pair.priceUsd || 0))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (!prices.length) {
    throw new Error("Could not obtain the current BNB/USD price.");
  }

  return prices[0];
}

export async function scanPair(
  token: TokenConfig,
  fromBlock: number,
  toBlock: number
): Promise<BuyEvent[]> {
  const logs = await provider.getLogs({
    address: token.pair,
    fromBlock,
    toBlock,
    topics: [SWAP_ABI_TOPIC]
  });

  const iface = new Contract(token.pair, SWAP_ABI, provider).interface;
  const buys: BuyEvent[] = [];

  for (const log of logs) {
    try {
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });

      if (!parsed) continue;

      const buy = decodeBuy(
        token,
        parsed.args,
        log.transactionHash,
        log.blockNumber
      );

      if (buy) buys.push(buy);
    } catch {
      // Ignore malformed/unexpected logs.
    }
  }

  return buys;
}

const SWAP_ABI_TOPIC = "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";