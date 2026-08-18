export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)"
] as const;

export const FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)"
] as const;

export const PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)"
] as const;

export const SWAP_ABI = [
  "event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)"
] as const;

export const PANCAKE_V2_FACTORY =
  "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";

export const WBNB =
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

export const SWAP_TOPIC =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";