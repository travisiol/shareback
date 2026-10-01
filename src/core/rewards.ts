import type { Campaign, RewardPolicy } from "../config/reward-policy.ts";
import { parseUnits } from "./units.ts";

export interface RewardInput {
  companyKey: string | null;
  totalMinor: number;
  currency: string;
}

export interface CampaignUsage {
  /** Base units reserved, in flight or paid for this campaign. */
  committedUnits: bigint;
}

export interface UserUsage {
  /** Rewards this account reserved in the last 30 days. */
  rewardsLast30Days: number;
}

export type RewardDecision =
  | { ok: true; campaign: Campaign; amountUnits: bigint }
  | { ok: false; reason: string };

/** Quantity the policy grants for this receipt, before budget and user limits. */
export function tierAmount(campaign: Campaign, totalMinor: number): bigint {
  let amount = BigInt(0);
  for (const tier of campaign.tiers) {
    if (totalMinor >= tier.minTotalMinor) {
      const units = parseUnits(tier.amount, campaign.tokenDecimals);
      if (units > amount) amount = units;
    }
  }
  const cap = parseUnits(campaign.perReceiptCap, campaign.tokenDecimals);
  return amount > cap ? cap : amount;
}

export function findCampaign(policy: RewardPolicy, companyKey: string | null, currency: string): Campaign | null {
  if (!companyKey) return null;
  return policy.campaigns.find((c) => c.active && c.companyKey === companyKey && c.currency === currency) ?? null;
}

/**
 * Decide whether a verified receipt can have a reward reserved right now.
 * A refusal is not a rejection: the receipt stays approved and can be
 * retried when a campaign is funded.
 */
export function decideReward(
  policy: RewardPolicy,
  input: RewardInput,
  usageOf: (campaign: Campaign) => CampaignUsage,
  user: UserUsage,
): RewardDecision {
  const campaign = findCampaign(policy, input.companyKey, input.currency);
  if (!campaign) return { ok: false, reason: "No funded campaign covers this company and currency yet." };

  const amountUnits = tierAmount(campaign, input.totalMinor);
  if (amountUnits <= BigInt(0)) return { ok: false, reason: "The receipt total is below this campaign's minimum." };

  if (user.rewardsLast30Days >= policy.maxRewardsPerUserPer30Days)
    return { ok: false, reason: "This account has reached the reward limit for the last 30 days." };

  const budget = parseUnits(campaign.budget, campaign.tokenDecimals);
  const available = budget - usageOf(campaign).committedUnits;
  if (amountUnits > available) return { ok: false, reason: "This campaign's budget is fully reserved." };

  return { ok: true, campaign, amountUnits };
}
