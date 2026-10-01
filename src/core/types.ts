import type { ReceiptStatus } from "./status.ts";

export interface ReceiptFields {
  merchant: string;
  /** ISO date, YYYY-MM-DD. */
  purchaseDate: string;
  /** Total in minor units (cents). */
  totalMinor: number;
  currency: string;
}

export type RewardStatus = "reserved" | "claiming" | "claimed" | "released";

export interface RewardView {
  id: string;
  campaignId: string;
  tokenSymbol: string;
  /** Token quantity as a decimal string. */
  amount: string;
  status: RewardStatus;
  txHash: string | null;
  claimedAt: number | null;
}

export interface HistoryEntry {
  at: number;
  action: string;
  from: ReceiptStatus | null;
  to: ReceiptStatus | null;
  note: string | null;
  /** "you", "reviewer", "system" — never a reviewer's identity. */
  actor: string;
}

export type FieldSource = "manual" | "extracted";

export interface ReceiptView extends ReceiptFields {
  id: string;
  status: ReceiptStatus;
  /** Company matched by the merchant rule, or confirmed by a reviewer. */
  companyKey: string | null;
  fieldSource: FieldSource;
  fileName: string | null;
  fileMime: string | null;
  hasFile: boolean;
  rejectReason: string | null;
  /** Why an approved receipt has no reserved reward yet. */
  fundingNote: string | null;
  createdAt: number;
  updatedAt: number;
  reward: RewardView | null;
  history: HistoryEntry[];
}

export interface ClaimVoucher {
  claimId: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
  amount: string; // base units
  expiry: number; // unix seconds
  signature: `0x${string}`;
}
