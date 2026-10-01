/**
 * The live ledger: receipts, review decisions, reward reservations and
 * claims, on SQLite. Every rule that protects the reward pool lives here so
 * it can be tested without HTTP:
 *
 * - a receipt belongs to one account and is only readable by it;
 * - only a reviewer decision moves a receipt out of review;
 * - approval never creates a liability — a reward exists only once its
 *   quantity was reserved inside the campaign budget, in one transaction;
 * - one receipt can hold one reward (UNIQUE), one reward has one claim id,
 *   and re-requesting a claim returns the same authorization.
 */
import type { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { matchMerchant } from "../config/eligibility.ts";
import type { RewardPolicy } from "../config/reward-policy.ts";
import { FILE_RETENTION_DAYS_AFTER_DECISION } from "../config/uploads.ts";
import { fingerprint } from "./fields.ts";
import { decideReward } from "./rewards.ts";
import { canTransition } from "./status.ts";
import type { ReceiptStatus } from "./status.ts";
import type { ClaimVoucher, HistoryEntry, ReceiptFields, ReceiptView, RewardStatus } from "./types.ts";
import { formatUnits } from "./units.ts";

const DAY_MS = 86_400_000;

export class LedgerError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "LedgerError";
    this.status = status;
  }
}

/** What the ledger needs from the chain. The server provides the real one. */
export interface ClaimAdapter {
  /** Address of the reward token, or null when it is not configured. */
  tokenAddress(symbol: string): `0x${string}` | null;
  sign(voucher: Omit<ClaimVoucher, "signature">): Promise<`0x${string}`>;
  /** State of a submitted claim transaction, after the required confirmations. */
  txStatus(claimId: `0x${string}`, txHash: `0x${string}`): Promise<"confirmed" | "pending" | "failed">;
  /** On-chain truth: has this claim id been paid? */
  isClaimed(claimId: `0x${string}`): Promise<boolean>;
  voucherTtlSeconds: number;
}

export interface StoredFile {
  name: string;
  mime: string;
  size: number;
  sha256: string;
  ext: string;
}

export interface AdminReceiptView extends ReceiptView {
  owner: string;
  duplicateFlags: string[];
  fileSize: number | null;
}

interface ReceiptRow {
  id: string;
  owner: string;
  status: ReceiptStatus;
  merchant: string;
  purchase_date: string;
  total_minor: number;
  currency: string;
  company_key: string | null;
  field_source: string;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  file_ext: string | null;
  file_sha256: string | null;
  has_file: number;
  fingerprint: string;
  duplicate_flags: string;
  reject_reason: string | null;
  funding_note: string | null;
  created_at: number;
  updated_at: number;
  decided_at: number | null;
}

interface RewardRow {
  id: string;
  receipt_id: string;
  owner: string;
  campaign_id: string;
  token_symbol: string;
  token_decimals: number;
  amount_units: string;
  status: RewardStatus;
  claim_id: string;
  voucher: string | null;
  voucher_expiry: number | null;
  tx_hash: string | null;
  created_at: number;
  claimed_at: number | null;
}

interface AuditRow {
  at: number;
  actor: string;
  action: string;
  from_status: ReceiptStatus | null;
  to_status: ReceiptStatus | null;
  note: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  merchant TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  total_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  company_key TEXT,
  field_source TEXT NOT NULL,
  file_name TEXT,
  file_mime TEXT,
  file_size INTEGER,
  file_ext TEXT,
  file_sha256 TEXT,
  has_file INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT NOT NULL,
  duplicate_flags TEXT NOT NULL DEFAULT '[]',
  reject_reason TEXT,
  funding_note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_owner_file ON receipts(owner, file_sha256);
CREATE INDEX IF NOT EXISTS receipts_owner ON receipts(owner, created_at);
CREATE INDEX IF NOT EXISTS receipts_fingerprint ON receipts(fingerprint);
CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL UNIQUE,
  owner TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_decimals INTEGER NOT NULL,
  amount_units TEXT NOT NULL,
  status TEXT NOT NULL,
  claim_id TEXT NOT NULL UNIQUE,
  voucher TEXT,
  voucher_expiry INTEGER,
  tx_hash TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER
);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS audit_receipt ON audit(receipt_id, id);
CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`;

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("hex")}`;
}

export class Ledger {
  private db: DatabaseSync;
  private policy: RewardPolicy;
  private now: () => number;

  constructor(db: DatabaseSync, policy: RewardPolicy, now: () => number = () => Date.now()) {
    this.db = db;
    this.policy = policy;
    this.now = now;
    db.exec(SCHEMA);
  }

  // ───────────────────────────── helpers

  private tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private row(id: string): ReceiptRow | undefined {
    return this.db.prepare("SELECT * FROM receipts WHERE id = ?").get(id) as ReceiptRow | undefined;
  }

  private rewardOf(receiptId: string): RewardRow | undefined {
    return this.db.prepare("SELECT * FROM rewards WHERE receipt_id = ?").get(receiptId) as RewardRow | undefined;
  }

  private audit(receiptId: string, actor: string, action: string, from: ReceiptStatus | null, to: ReceiptStatus | null, note: string | null = null) {
    this.db
      .prepare("INSERT INTO audit (receipt_id, at, actor, action, from_status, to_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(receiptId, this.now(), actor, action, from, to, note);
  }

  /** Compare-and-set status change. Throws when the receipt moved meanwhile. */
  private move(row: ReceiptRow, to: ReceiptStatus, actor: string, action: string, note: string | null = null) {
    if (!canTransition(row.status, to)) throw new LedgerError(409, `A ${row.status} receipt cannot become ${to}.`);
    const now = this.now();
    const result = this.db
      .prepare("UPDATE receipts SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
      .run(to, now, row.id, row.status);
    if (result.changes !== 1) throw new LedgerError(409, "This receipt changed while the request was in flight.");
    this.audit(row.id, actor, action, row.status, to, note);
  }

  private view(row: ReceiptRow): ReceiptView {
    const reward = this.rewardOf(row.id);
    const audit = this.db
      .prepare("SELECT at, actor, action, from_status, to_status, note FROM audit WHERE receipt_id = ? ORDER BY id")
      .all(row.id) as unknown as AuditRow[];
    const history: HistoryEntry[] = audit.map((a) => ({
      at: a.at,
      action: a.action,
      from: a.from_status,
      to: a.to_status,
      note: a.note,
      actor: a.actor === row.owner ? "you" : a.actor === "system" ? "system" : "reviewer",
    }));
    return {
      id: row.id,
      status: row.status,
      merchant: row.merchant,
      purchaseDate: row.purchase_date,
      totalMinor: row.total_minor,
      currency: row.currency,
      companyKey: row.company_key,
      fieldSource: row.field_source === "extracted" ? "extracted" : "manual",
      fileName: row.file_name,
      fileMime: row.file_mime,
      hasFile: row.has_file === 1,
      rejectReason: row.reject_reason,
      fundingNote: row.funding_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      reward:
        reward && reward.status !== "released"
          ? {
              id: reward.id,
              campaignId: reward.campaign_id,
              tokenSymbol: reward.token_symbol,
              amount: formatUnits(BigInt(reward.amount_units), reward.token_decimals),
              status: reward.status,
              txHash: reward.tx_hash,
              claimedAt: reward.claimed_at,
            }
          : null,
      history,
    };
  }

  private owned(id: string, owner: string): ReceiptRow {
    const row = this.row(id);
    // Same answer for "missing" and "not yours": never confirm another account's receipt exists.
    if (!row || row.owner !== owner) throw new LedgerError(404, "Receipt not found.");
    return row;
  }

  // ───────────────────────────── sign-in nonces

  issueNonce(ttlMs = 10 * 60_000): string {
    const nonce = randomBytes(16).toString("hex");
    this.db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(this.now());
    this.db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(nonce, this.now() + ttlMs);
    return nonce;
  }

  /** Single use: a nonce is deleted the moment it is checked. */
  consumeNonce(nonce: string): boolean {
    const result = this.db.prepare("DELETE FROM nonces WHERE nonce = ? AND expires_at >= ?").run(nonce, this.now());
    return result.changes === 1;
  }

  // ───────────────────────────── user side

  /**
   * Record a submitted receipt. Idempotent per (owner, file): sending the
   * same file again returns the existing receipt instead of a second one.
   */
  createReceipt(owner: string, fields: ReceiptFields, file: StoredFile): { receipt: ReceiptView; created: boolean } {
    return this.tx(() => {
      const existing = this.db
        .prepare("SELECT * FROM receipts WHERE owner = ? AND file_sha256 = ?")
        .get(owner, file.sha256) as ReceiptRow | undefined;
      if (existing) return { receipt: this.view(existing), created: false };

      const since = this.now() - DAY_MS;
      const recent = this.db
        .prepare("SELECT COUNT(*) AS n FROM receipts WHERE owner = ? AND created_at > ?")
        .get(owner, since) as { n: number };
      if (recent.n >= this.policy.maxSubmissionsPerUserPerDay)
        throw new LedgerError(429, "Daily submission limit reached. Try again tomorrow.");

      const print = fingerprint(fields);
      const flags: string[] = [];
      const sameFile = this.db
        .prepare("SELECT COUNT(*) AS n FROM receipts WHERE file_sha256 = ? AND owner != ?")
        .get(file.sha256, owner) as { n: number };
      if (sameFile.n > 0) flags.push("identical_file_other_account");
      const sameDetails = this.db
        .prepare("SELECT COUNT(*) AS n FROM receipts WHERE fingerprint = ?")
        .get(print) as { n: number };
      if (sameDetails.n > 0) flags.push("matching_merchant_date_total");

      const match = matchMerchant(fields.merchant);
      const id = newId("r");
      const now = this.now();
      this.db
        .prepare(
          `INSERT INTO receipts (id, owner, status, merchant, purchase_date, total_minor, currency, company_key,
             field_source, file_name, file_mime, file_size, file_ext, file_sha256, has_file, fingerprint,
             duplicate_flags, created_at, updated_at)
           VALUES (?, ?, 'submitted', ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
        )
        .run(
          id,
          owner,
          fields.merchant,
          fields.purchaseDate,
          fields.totalMinor,
          fields.currency,
          match.kind === "eligible" ? match.company.key : null,
          file.name,
          file.mime,
          file.size,
          file.ext,
          file.sha256,
          print,
          JSON.stringify(flags),
          now,
          now,
        );
      this.audit(id, owner, "submitted", "draft", "submitted");
      return { receipt: this.view(this.row(id) as ReceiptRow), created: true };
    });
  }

  listReceipts(owner: string): ReceiptView[] {
    const rows = this.db
      .prepare("SELECT * FROM receipts WHERE owner = ? ORDER BY created_at DESC")
      .all(owner) as unknown as ReceiptRow[];
    return rows.map((r) => this.view(r));
  }

  getReceipt(id: string, owner: string): ReceiptView {
    return this.view(this.owned(id, owner));
  }

  /** Storage key of a receipt file, only for its owner. */
  fileKey(id: string, owner: string): { key: string; mime: string; name: string } {
    const row = this.owned(id, owner);
    if (row.has_file !== 1 || !row.file_ext || !row.file_mime) throw new LedgerError(404, "The file is no longer stored.");
    return { key: `${row.id}.${row.file_ext}`, mime: row.file_mime, name: row.file_name ?? "receipt" };
  }

  /**
   * Delete a receipt and everything attached to it. Allowed until a claim
   * starts; a reserved reward goes back to the campaign budget.
   */
  deleteReceipt(id: string, owner: string): { fileKey: string | null } {
    return this.tx(() => {
      const row = this.owned(id, owner);
      if (row.status === "claiming" || row.status === "claimed")
        throw new LedgerError(409, "A receipt with a claim cannot be deleted. Its file is removed under the retention policy.");
      this.db.prepare("DELETE FROM rewards WHERE receipt_id = ? AND status = 'reserved'").run(id);
      this.db.prepare("DELETE FROM audit WHERE receipt_id = ?").run(id);
      this.db.prepare("DELETE FROM receipts WHERE id = ?").run(id);
      return { fileKey: row.has_file === 1 && row.file_ext ? `${row.id}.${row.file_ext}` : null };
    });
  }

  /** Undo a creation whose file could not be stored. */
  discard(id: string) {
    this.db.prepare("DELETE FROM audit WHERE receipt_id = ?").run(id);
    this.db.prepare("DELETE FROM receipts WHERE id = ? AND status = 'submitted'").run(id);
  }

  // ───────────────────────────── review side (callers must have checked admin access)

  private adminView(row: ReceiptRow): AdminReceiptView {
    return {
      ...this.view(row),
      history: (
        this.db
          .prepare("SELECT at, actor, action, from_status, to_status, note FROM audit WHERE receipt_id = ? ORDER BY id")
          .all(row.id) as unknown as AuditRow[]
      ).map((a) => ({ at: a.at, action: a.action, from: a.from_status, to: a.to_status, note: a.note, actor: a.actor })),
      owner: row.owner,
      duplicateFlags: JSON.parse(row.duplicate_flags) as string[],
      fileSize: row.file_size,
    };
  }

  adminList(): AdminReceiptView[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM receipts ORDER BY
           CASE status WHEN 'submitted' THEN 0 WHEN 'under_review' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
           created_at DESC LIMIT 200`,
      )
      .all() as unknown as ReceiptRow[];
    return rows.map((r) => this.adminView(r));
  }

  adminFileKey(id: string): { key: string; mime: string } {
    const row = this.row(id);
    if (!row || row.has_file !== 1 || !row.file_ext || !row.file_mime) throw new LedgerError(404, "File not found.");
    return { key: `${row.id}.${row.file_ext}`, mime: row.file_mime };
  }

  startReview(id: string, actor: string): AdminReceiptView {
    return this.tx(() => {
      const row = this.row(id);
      if (!row) throw new LedgerError(404, "Receipt not found.");
      this.move(row, "under_review", actor, "review_started");
      return this.adminView(this.row(id) as ReceiptRow);
    });
  }

  reject(id: string, actor: string, reason: string): AdminReceiptView {
    const note = reason.trim();
    if (note.length < 8) throw new LedgerError(400, "Give the user a reason they can act on.");
    return this.tx(() => {
      const row = this.row(id);
      if (!row) throw new LedgerError(404, "Receipt not found.");
      if (row.status !== "submitted" && row.status !== "under_review")
        throw new LedgerError(409, `A ${row.status} receipt cannot be rejected.`);
      this.move(row, "rejected", actor, "rejected", note);
      this.db.prepare("UPDATE receipts SET reject_reason = ?, decided_at = ? WHERE id = ?").run(note, this.now(), id);
      return this.adminView(this.row(id) as ReceiptRow);
    });
  }

  /**
   * Approve the purchase as verified, for one confirmed company, then try to
   * reserve its reward. Approval and reservation are separate facts: the
   * receipt is claimable only if the reservation succeeded.
   */
  approve(id: string, actor: string, companyKey: string): AdminReceiptView {
    return this.tx(() => {
      const row = this.row(id);
      if (!row) throw new LedgerError(404, "Receipt not found.");
      if (row.status !== "submitted" && row.status !== "under_review")
        throw new LedgerError(409, `A ${row.status} receipt cannot be approved.`);
      this.move(row, "approved", actor, "approved", `Verified as a ${companyKey} purchase`);
      this.db.prepare("UPDATE receipts SET company_key = ?, decided_at = ? WHERE id = ?").run(companyKey, this.now(), id);
      this.reserveInTx(id);
      return this.adminView(this.row(id) as ReceiptRow);
    });
  }

  /** Retry a reservation for an approved receipt (e.g. after a campaign is funded). */
  reserve(id: string): AdminReceiptView {
    return this.tx(() => {
      if (!this.row(id)) throw new LedgerError(404, "Receipt not found.");
      this.reserveInTx(id);
      return this.adminView(this.row(id) as ReceiptRow);
    });
  }

  committedUnits(campaignId: string): bigint {
    const rows = this.db
      .prepare("SELECT amount_units FROM rewards WHERE campaign_id = ? AND status IN ('reserved','claiming','claimed')")
      .all(campaignId) as unknown as { amount_units: string }[];
    return rows.reduce((sum, r) => sum + BigInt(r.amount_units), BigInt(0));
  }

  private reserveInTx(id: string) {
    const row = this.row(id) as ReceiptRow;
    if (row.status !== "approved") return;
    if (this.rewardOf(id)) return; // one reward per receipt, ever

    const recent = this.db
      .prepare("SELECT COUNT(*) AS n FROM rewards WHERE owner = ? AND status != 'released' AND created_at > ?")
      .get(row.owner, this.now() - 30 * DAY_MS) as { n: number };

    const decision = decideReward(
      this.policy,
      { companyKey: row.company_key, totalMinor: row.total_minor, currency: row.currency },
      (campaign) => ({ committedUnits: this.committedUnits(campaign.id) }),
      { rewardsLast30Days: recent.n },
    );

    if (!decision.ok) {
      this.db.prepare("UPDATE receipts SET funding_note = ? WHERE id = ?").run(decision.reason, id);
      return;
    }

    this.db
      .prepare(
        `INSERT INTO rewards (id, receipt_id, owner, campaign_id, token_symbol, token_decimals, amount_units, status, claim_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?)`,
      )
      .run(
        newId("w"),
        id,
        row.owner,
        decision.campaign.id,
        decision.campaign.tokenSymbol,
        decision.campaign.tokenDecimals,
        decision.amountUnits.toString(),
        `0x${randomBytes(32).toString("hex")}`,
        this.now(),
      );
    this.db.prepare("UPDATE receipts SET funding_note = NULL WHERE id = ?").run(id);
    this.move(row, "claimable", "system", "reward_reserved", `Reserved from campaign ${decision.campaign.id}`);
  }

  /** Files past retention. The caller deletes them, then calls markFileRemoved. */
  expiredFiles(): { id: string; key: string }[] {
    const cutoff = this.now() - FILE_RETENTION_DAYS_AFTER_DECISION * DAY_MS;
    const rows = this.db
      .prepare("SELECT * FROM receipts WHERE has_file = 1 AND status IN ('rejected','claimed') AND updated_at < ?")
      .all(cutoff) as unknown as ReceiptRow[];
    return rows.filter((r) => r.file_ext).map((r) => ({ id: r.id, key: `${r.id}.${r.file_ext}` }));
  }

  markFileRemoved(id: string) {
    this.db.prepare("UPDATE receipts SET has_file = 0 WHERE id = ?").run(id);
    this.audit(id, "system", "file_removed", null, null, "Retention period ended");
  }

  // ───────────────────────────── claims

  /**
   * Get the signed authorization for a claimable reward. Calling it twice —
   * or from two tabs at once — returns the same authorization; a new one is
   * only signed when the previous one expired unpaid, and it reuses the same
   * claim id, which the contract pays at most once.
   */
  async beginClaim(id: string, owner: string, adapter: ClaimAdapter): Promise<{ voucher: ClaimVoucher; receipt: ReceiptView }> {
    const row = this.owned(id, owner);
    if (row.status !== "claimable" && row.status !== "claiming")
      throw new LedgerError(409, "This receipt has no claimable reward.");
    const reward = this.rewardOf(id);
    if (!reward) throw new LedgerError(409, "No reward is reserved for this receipt.");

    const nowSeconds = Math.floor(this.now() / 1000);
    const stored = reward.voucher ? (JSON.parse(reward.voucher) as ClaimVoucher) : null;

    if (stored && stored.expiry > nowSeconds + 30) {
      this.enterClaiming(id, owner);
      return { voucher: stored, receipt: this.getReceipt(id, owner) };
    }

    const claimId = reward.claim_id as `0x${string}`;
    if (stored && (await adapter.isClaimed(claimId))) {
      this.finalize(id, reward.tx_hash);
      throw new LedgerError(409, "This reward was already claimed.");
    }

    const token = adapter.tokenAddress(reward.token_symbol);
    if (!token) throw new LedgerError(503, "The reward token is not configured.");

    const unsigned = {
      claimId,
      recipient: owner as `0x${string}`,
      token,
      amount: reward.amount_units,
      expiry: nowSeconds + adapter.voucherTtlSeconds,
    };
    const voucher: ClaimVoucher = { ...unsigned, signature: await adapter.sign(unsigned) };

    // Compare-and-set on the previous expiry: of two concurrent requests, one wins and both return its voucher.
    const result = this.db
      .prepare(
        "UPDATE rewards SET voucher = ?, voucher_expiry = ? WHERE id = ? AND status IN ('reserved','claiming') AND voucher_expiry IS ?",
      )
      .run(JSON.stringify(voucher), voucher.expiry, reward.id, reward.voucher_expiry);
    const winner =
      result.changes === 1 ? voucher : (JSON.parse((this.rewardOf(id) as RewardRow).voucher as string) as ClaimVoucher);

    this.enterClaiming(id, owner);
    return { voucher: winner, receipt: this.getReceipt(id, owner) };
  }

  private enterClaiming(id: string, owner: string) {
    this.tx(() => {
      const row = this.row(id) as ReceiptRow;
      if (row.status !== "claimable") return;
      this.move(row, "claiming", owner, "claim_started");
      this.db.prepare("UPDATE rewards SET status = 'claiming' WHERE receipt_id = ? AND status = 'reserved'").run(id);
    });
  }

  private finalize(id: string, txHash: string | null) {
    this.tx(() => {
      const row = this.row(id) as ReceiptRow;
      if (row.status === "claimed") return;
      if (row.status === "claimable") this.move(row, "claiming", "system", "claim_started");
      this.move({ ...row, status: "claiming" }, "claimed", "system", "claim_confirmed", txHash);
      this.db
        .prepare("UPDATE rewards SET status = 'claimed', claimed_at = ?, tx_hash = COALESCE(?, tx_hash) WHERE receipt_id = ?")
        .run(this.now(), txHash, id);
    });
  }

  /**
   * Reconcile a claim with the chain. With a transaction hash the claim is
   * confirmed, left pending, or returned to claimable if it failed. Nothing
   * is marked claimed on the client's word.
   */
  async syncClaim(id: string, owner: string, adapter: ClaimAdapter, txHash?: string): Promise<ReceiptView> {
    const row = this.owned(id, owner);
    if (row.status !== "claiming") return this.view(row);
    const reward = this.rewardOf(id) as RewardRow;
    const claimId = reward.claim_id as `0x${string}`;

    if (txHash !== undefined) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new LedgerError(400, "That is not a transaction hash.");
      try {
        this.db.prepare("UPDATE rewards SET tx_hash = ? WHERE id = ? AND status = 'claiming'").run(txHash.toLowerCase(), reward.id);
      } catch {
        throw new LedgerError(409, "That transaction is already attached to another claim.");
      }
    }

    const hash = (txHash?.toLowerCase() ?? reward.tx_hash) as `0x${string}` | null;
    if (hash) {
      const state = await adapter.txStatus(claimId, hash);
      if (state === "confirmed") this.finalize(id, hash);
      else if (state === "failed") this.backToClaimable(id, "The claim transaction failed. Nothing was paid.");
    } else if ((reward.voucher_expiry ?? 0) < Math.floor(this.now() / 1000)) {
      if (await adapter.isClaimed(claimId)) this.finalize(id, null);
      else this.backToClaimable(id, "The claim authorization expired before a transaction was sent.");
    }
    return this.getReceipt(id, owner);
  }

  private backToClaimable(id: string, note: string) {
    this.tx(() => {
      const row = this.row(id) as ReceiptRow;
      if (row.status !== "claiming") return;
      this.move(row, "claimable", "system", "claim_reset", note);
      this.db.prepare("UPDATE rewards SET status = 'reserved', tx_hash = NULL WHERE receipt_id = ? AND status = 'claiming'").run(id);
    });
  }
}
