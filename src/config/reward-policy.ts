/**
 * Server-controlled reward policy.
 *
 * Rewards are fixed token quantities set per campaign — they are never
 * derived from a share price, and there is no cashback rate. A campaign has
 * a hard budget; a reward only becomes claimable after its quantity has been
 * reserved against that budget.
 */

export interface RewardTier {
  /** Minimum receipt total, in minor units of `currency` (cents). */
  minTotalMinor: number;
  /** Token quantity as a decimal string, e.g. "0.005". */
  amount: string;
}

export interface Campaign {
  id: string;
  /** Key of the eligible company in eligibility.ts. */
  companyKey: string;
  /** Symbol of the reward token in network.ts. */
  tokenSymbol: string;
  tokenDecimals: number;
  /** Receipt currency this campaign accepts. */
  currency: string;
  /** Highest matching tier wins. */
  tiers: RewardTier[];
  /** Hard cap per receipt, whatever the tiers say. */
  perReceiptCap: string;
  /** Total tokens funded for this campaign. Reserved + paid can never exceed it. */
  budget: string;
  active: boolean;
}

export interface RewardPolicy {
  /** A receipt older than this (purchase date → submission) is not accepted. */
  maxReceiptAgeDays: number;
  /** Rewards one account can reserve in any rolling 30 days. */
  maxRewardsPerUserPer30Days: number;
  /** Receipts one account can submit in any rolling 24 hours. */
  maxSubmissionsPerUserPerDay: number;
  campaigns: Campaign[];
}

/**
 * LIVE policy. No campaign is funded yet, so the list is empty: approved
 * receipts stay "Approved" and nothing becomes claimable.
 *
 * To open a campaign, fund the reward contract with the token, then add an
 * entry such as:
 *
 *   {
 *     id: "aapl-2026-q4",
 *     companyKey: "apple",
 *     tokenSymbol: "AAPL",
 *     tokenDecimals: 18,
 *     currency: "USD",
 *     tiers: [{ minTotalMinor: 5_000, amount: "0.001" }],
 *     perReceiptCap: "0.005",
 *     budget: "2",          // must match what the contract actually holds
 *     active: true,
 *   }
 */
export const LIVE_POLICY: RewardPolicy = {
  maxReceiptAgeDays: 30,
  maxRewardsPerUserPer30Days: 5,
  maxSubmissionsPerUserPerDay: 10,
  campaigns: [],
};
