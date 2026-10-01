/**
 * The single place for network, token and reward-contract configuration.
 *
 * Nothing here is guessed:
 * - Chain ID, RPC and explorer come from the official Robinhood Chain docs
 *   (https://docs.robinhood.com/chain/connecting), and the chain ID was also
 *   read from the RPC with eth_chainId (0x1237 = 4663).
 * - Stock token addresses come from Robinhood's official asset list
 *   (GET https://api.robinhood.com/rhj/assets, read on 2026-10-01) and were
 *   also read on chain with name() / symbol() / decimals().
 *   Only tokens in that list can be configured here.
 * - There is no deployed SHAREBACK reward contract. Until
 *   NEXT_PUBLIC_REWARD_VAULT_ADDRESS is set, live claims stay disabled.
 */

export interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export const CHAIN: ChainConfig = {
  id: 4663,
  name: "Robinhood Chain",
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
};

export interface RewardToken {
  symbol: string;
  /** name() as returned by the contract. */
  onchainName: string;
  address: `0x${string}`;
  decimals: number;
  verifiedAtBlock: number;
}

/** Read with eth_call on 2026-10-01 at block 77,355,971. */
const VERIFIED_AT = 77_355_971;

export const REWARD_TOKENS: Record<string, RewardToken> = {
  AAPL: {
    symbol: "AAPL",
    onchainName: "Apple • Robinhood Token",
    address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
  NVDA: {
    symbol: "NVDA",
    onchainName: "NVIDIA • Robinhood Token",
    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
  TSLA: {
    symbol: "TSLA",
    onchainName: "Tesla • Robinhood Token",
    address: "0x322f0929c4625ed5bad873c95208d54e1c003b2d",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
  DELL: {
    symbol: "DELL",
    onchainName: "Dell • Robinhood Token",
    address: "0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
  NFLX: {
    symbol: "NFLX",
    onchainName: "Netflix • Robinhood Token",
    address: "0xE0444EF8BF4eD74f74FD73686e2ddF4C1c5591E8",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
  META: {
    symbol: "META",
    onchainName: "Meta Platforms • Robinhood Token",
    address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
    decimals: 18,
    verifiedAtBlock: VERIFIED_AT,
  },
};

/**
 * Stock tokens implement ERC-8056 (scaled UI amounts): the displayed balance
 * is the raw balance times a multiplier that moves with splits and dividends.
 * Reward quantities in this app are raw token units; apply the multiplier
 * only when presenting a holding next to a share price.
 */
export const TOKEN_NOTES = "Stock tokens are ERC-20 tokens with ERC-8056 scaled UI amounts.";

const vault = process.env.NEXT_PUBLIC_REWARD_VAULT_ADDRESS;

/** The reward contract. `null` means none is deployed/configured. */
export const REWARD_VAULT_ADDRESS: `0x${string}` | null =
  vault && /^0x[0-9a-fA-F]{40}$/.test(vault) ? (vault as `0x${string}`) : null;

/** Confirmations required before a claim is shown as "Claimed". */
export const CLAIM_CONFIRMATIONS = 3;

/** How long a signed claim authorization stays valid. */
export const CLAIM_VOUCHER_TTL_SECONDS = 15 * 60;

export function explorerTx(hash: string): string {
  return `${CHAIN.explorerUrl}/tx/${hash}`;
}
