import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Ledger, LedgerError } from "../src/core/ledger.ts";
import type { ClaimAdapter, StoredFile } from "../src/core/ledger.ts";
import type { RewardPolicy } from "../src/config/reward-policy.ts";
import { matchMerchant } from "../src/config/eligibility.ts";
import { parseTotal, sniffMime, validateFields } from "../src/core/fields.ts";
import { formatUnits, parseUnits } from "../src/core/units.ts";

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BOB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const ADMIN = "admin";
const NOW = Date.parse("2026-10-01T12:00:00Z");

const policy = (budget = "0.01"): RewardPolicy => ({
  maxReceiptAgeDays: 30,
  maxRewardsPerUserPer30Days: 2,
  maxSubmissionsPerUserPerDay: 5,
  campaigns: [
    {
      id: "test-aapl",
      companyKey: "apple",
      tokenSymbol: "AAPL",
      tokenDecimals: 18,
      currency: "USD",
      tiers: [
        { minTotalMinor: 5_000, amount: "0.001" },
        { minTotalMinor: 100_000, amount: "0.005" },
      ],
      perReceiptCap: "0.005",
      budget,
      active: true,
    },
  ],
});

let fileCounter = 0;
const file = (sha?: string): StoredFile => ({
  name: "receipt.png",
  mime: "image/png",
  size: 1234,
  sha256: sha ?? `sha-${++fileCounter}`,
  ext: "png",
});

const fields = (overrides = {}) => ({
  merchant: "Apple Store",
  purchaseDate: "2026-09-20",
  totalMinor: 129_700,
  currency: "USD",
  ...overrides,
});

function make(p: RewardPolicy = policy()) {
  const clock = { now: NOW };
  const ledger = new Ledger(new DatabaseSync(":memory:"), p, () => clock.now);
  return { ledger, clock };
}

function fakeChain() {
  const paid = new Set<string>();
  const txs = new Map<string, "confirmed" | "pending" | "failed">();
  let signed = 0;
  const adapter: ClaimAdapter = {
    voucherTtlSeconds: 900,
    tokenAddress: () => "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    sign: async () => {
      signed++;
      await new Promise((r) => setTimeout(r, 5));
      return `0x${"11".repeat(65)}`;
    },
    txStatus: async (_claimId, hash) => txs.get(hash) ?? "pending",
    isClaimed: async (claimId) => paid.has(claimId),
  };
  return { adapter, paid, txs, signedCount: () => signed };
}

const rejects = async (fn: () => unknown, status: number) => {
  await assert.rejects(async () => fn(), (e: unknown) => e instanceof LedgerError && e.status === status);
};

test("units round-trip without floating point", () => {
  assert.equal(parseUnits("0.005", 18), BigInt("5000000000000000"));
  assert.equal(formatUnits(BigInt("5000000000000000"), 18), "0.005");
  assert.equal(parseTotal("1,297.00"), 129_700);
  assert.equal(parseTotal("12.5"), 1_250);
  assert.equal(parseTotal("abc"), null);
});

test("eligibility follows the merchant, not product brands", () => {
  assert.equal(matchMerchant("Apple Store").kind, "eligible");
  assert.equal(matchMerchant("APPLE STORE #124").kind, "eligible");
  assert.equal(matchMerchant("Amazon").kind, "third-party");
  // A product name in the merchant field is not an exact merchant match.
  assert.equal(matchMerchant("Amazon - Apple MacBook Air").kind, "unknown");
  assert.equal(matchMerchant("Corner Shop").kind, "unknown");
});

test("field validation: age limit, future dates, totals, currency", () => {
  assert.equal(validateFields(fields(), NOW, 30).ok, true);
  const old = validateFields(fields({ purchaseDate: "2026-07-01" }), NOW, 30);
  assert.equal(old.ok, false);
  const future = validateFields(fields({ purchaseDate: "2026-12-01" }), NOW, 30);
  assert.equal(future.ok, false);
  assert.equal(validateFields(fields({ totalMinor: 0 }), NOW, 30).ok, false);
  assert.equal(validateFields(fields({ currency: "XYZ" }), NOW, 30).ok, false);
});

test("file type comes from the bytes, not the claimed type", () => {
  assert.equal(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(sniffMime(new TextEncoder().encode("%PDF-1.7")), "application/pdf");
  assert.equal(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>")), null);
  assert.equal(sniffMime(new TextEncoder().encode("MZ\x90\x00")), null);
});

test("a receipt is visible only to its owner", async () => {
  const { ledger } = make();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  assert.equal(ledger.getReceipt(receipt.id, ALICE).id, receipt.id);
  await rejects(() => ledger.getReceipt(receipt.id, BOB), 404);
  await rejects(() => ledger.fileKey(receipt.id, BOB), 404);
  await rejects(() => ledger.deleteReceipt(receipt.id, BOB), 404);
  assert.equal(ledger.listReceipts(BOB).length, 0);
  assert.equal(ledger.listReceipts(ALICE).length, 1);
});

test("submitting the same file twice returns the same receipt", () => {
  const { ledger } = make();
  const a = ledger.createReceipt(ALICE, fields(), file("same"));
  const b = ledger.createReceipt(ALICE, fields(), file("same"));
  assert.equal(a.created, true);
  assert.equal(b.created, false);
  assert.equal(a.receipt.id, b.receipt.id);
  assert.equal(ledger.listReceipts(ALICE).length, 1);
});

test("likely duplicates across accounts are flagged for the reviewer", () => {
  const { ledger } = make();
  ledger.createReceipt(ALICE, fields(), file("shared"));
  const second = ledger.createReceipt(BOB, fields(), file("shared"));
  const admin = ledger.adminList().find((r) => r.id === second.receipt.id);
  assert.deepEqual(admin?.duplicateFlags, ["identical_file_other_account", "matching_merchant_date_total"]);
});

test("daily submission limit", async () => {
  const { ledger } = make();
  for (let i = 0; i < 5; i++) ledger.createReceipt(ALICE, fields({ totalMinor: 6_000 + i }), file());
  await rejects(() => ledger.createReceipt(ALICE, fields({ totalMinor: 9_999 }), file()), 429);
});

test("approval reserves a reward inside the budget and makes it claimable", () => {
  const { ledger } = make();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  assert.equal(receipt.status, "submitted");
  assert.equal(receipt.reward, null);
  ledger.startReview(receipt.id, ADMIN);
  const approved = ledger.approve(receipt.id, ADMIN, "apple");
  assert.equal(approved.status, "claimable");
  assert.equal(approved.reward?.amount, "0.005");
  assert.equal(ledger.committedUnits("test-aapl"), parseUnits("0.005", 18));
  assert.deepEqual(
    approved.history.map((h) => h.action),
    ["submitted", "review_started", "approved", "reward_reserved"],
  );
});

test("approved is not claimable when no campaign funds it", () => {
  const { ledger } = make({ ...policy(), campaigns: [] });
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  const approved = ledger.approve(receipt.id, ADMIN, "apple");
  assert.equal(approved.status, "approved");
  assert.equal(approved.reward, null);
  assert.match(approved.fundingNote ?? "", /No funded campaign/);
});

test("the campaign budget is a hard ceiling", () => {
  const { ledger } = make(policy("0.008"));
  const first = ledger.createReceipt(ALICE, fields(), file());
  const second = ledger.createReceipt(BOB, fields({ purchaseDate: "2026-09-21" }), file());
  assert.equal(ledger.approve(first.receipt.id, ADMIN, "apple").status, "claimable");
  const blocked = ledger.approve(second.receipt.id, ADMIN, "apple");
  assert.equal(blocked.status, "approved");
  assert.match(blocked.fundingNote ?? "", /fully reserved/);
  assert.equal(ledger.committedUnits("test-aapl"), parseUnits("0.005", 18));
  // Retrying does not create a liability either.
  assert.equal(ledger.reserve(second.receipt.id).status, "approved");
});

test("per-user reward limit over 30 days", () => {
  const { ledger } = make(policy("1"));
  const ids = [0, 1, 2].map((i) => ledger.createReceipt(ALICE, fields({ totalMinor: 7_000 + i }), file()).receipt.id);
  assert.equal(ledger.approve(ids[0], ADMIN, "apple").status, "claimable");
  assert.equal(ledger.approve(ids[1], ADMIN, "apple").status, "claimable");
  const third = ledger.approve(ids[2], ADMIN, "apple");
  assert.equal(third.status, "approved");
  assert.match(third.fundingNote ?? "", /reward limit/);
});

test("reviewer decisions cannot be replayed or reversed", async () => {
  const { ledger } = make();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  await rejects(() => ledger.reject(receipt.id, ADMIN, "no"), 400);
  ledger.approve(receipt.id, ADMIN, "apple");
  await rejects(() => ledger.approve(receipt.id, ADMIN, "apple"), 409);
  await rejects(() => ledger.reject(receipt.id, ADMIN, "Changed my mind about it"), 409);
  assert.equal(ledger.committedUnits("test-aapl"), parseUnits("0.005", 18));

  const other = ledger.createReceipt(BOB, fields({ merchant: "Amazon" }), file());
  const rejected = ledger.reject(other.receipt.id, ADMIN, "Amazon is the merchant; product brands do not qualify.");
  assert.equal(rejected.status, "rejected");
  assert.match(ledger.getReceipt(other.receipt.id, BOB).rejectReason ?? "", /Amazon is the merchant/);
  await rejects(() => ledger.approve(other.receipt.id, ADMIN, "apple"), 409);
});

test("a claim needs a claimable reward and the owner's session", async () => {
  const { ledger } = make();
  const chain = fakeChain();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  await rejects(() => ledger.beginClaim(receipt.id, ALICE, chain.adapter), 409); // still submitted
  ledger.approve(receipt.id, ADMIN, "apple");
  await rejects(() => ledger.beginClaim(receipt.id, BOB, chain.adapter), 404);
  assert.equal(chain.signedCount(), 0);
});

test("concurrent and repeated claim requests share one authorization", async () => {
  const { ledger } = make();
  const chain = fakeChain();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  ledger.approve(receipt.id, ADMIN, "apple");

  const results = await Promise.all([1, 2, 3, 4].map(() => ledger.beginClaim(receipt.id, ALICE, chain.adapter)));
  const ids = new Set(results.map((r) => r.voucher.claimId));
  const expiries = new Set(results.map((r) => r.voucher.expiry));
  assert.equal(ids.size, 1);
  assert.equal(expiries.size, 1);
  assert.equal(results[0].voucher.recipient, ALICE);
  assert.equal(results[0].voucher.amount, parseUnits("0.005", 18).toString());

  const again = await ledger.beginClaim(receipt.id, ALICE, chain.adapter);
  assert.equal(again.voucher.claimId, results[0].voucher.claimId);
  assert.equal(again.receipt.status, "claiming");
  assert.equal(ledger.committedUnits("test-aapl"), parseUnits("0.005", 18));
});

test("claimed only after the chain confirms; failures return to claimable", async () => {
  const { ledger } = make();
  const chain = fakeChain();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  ledger.approve(receipt.id, ADMIN, "apple");
  await ledger.beginClaim(receipt.id, ALICE, chain.adapter);

  const failedTx = `0x${"aa".repeat(32)}`;
  chain.txs.set(failedTx, "pending");
  assert.equal((await ledger.syncClaim(receipt.id, ALICE, chain.adapter, failedTx)).status, "claiming");
  chain.txs.set(failedTx, "failed");
  const reset = await ledger.syncClaim(receipt.id, ALICE, chain.adapter);
  assert.equal(reset.status, "claimable");
  assert.equal(reset.reward?.txHash, null);

  await rejects(() => ledger.syncClaim(receipt.id, BOB, chain.adapter, failedTx), 404);

  const first = await ledger.beginClaim(receipt.id, ALICE, chain.adapter);
  const okTx = `0x${"bb".repeat(32)}`;
  chain.txs.set(okTx, "confirmed");
  chain.paid.add(first.voucher.claimId);
  const done = await ledger.syncClaim(receipt.id, ALICE, chain.adapter, okTx);
  assert.equal(done.status, "claimed");
  assert.equal(done.reward?.status, "claimed");
  assert.equal(done.reward?.txHash, okTx);

  // Nothing after "claimed" can start another payout.
  await rejects(() => ledger.beginClaim(receipt.id, ALICE, chain.adapter), 409);
  await rejects(() => ledger.deleteReceipt(receipt.id, ALICE), 409);
  assert.equal(ledger.committedUnits("test-aapl"), parseUnits("0.005", 18));
});

test("an expired authorization is re-signed with the same claim id", async () => {
  const { ledger, clock } = make();
  const chain = fakeChain();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  ledger.approve(receipt.id, ADMIN, "apple");
  const first = await ledger.beginClaim(receipt.id, ALICE, chain.adapter);

  clock.now += 20 * 60_000;
  const reset = await ledger.syncClaim(receipt.id, ALICE, chain.adapter);
  assert.equal(reset.status, "claimable");

  const second = await ledger.beginClaim(receipt.id, ALICE, chain.adapter);
  assert.equal(second.voucher.claimId, first.voucher.claimId);
  assert.ok(second.voucher.expiry > first.voucher.expiry);

  // If the first authorization was in fact paid on chain, no new one is signed.
  clock.now += 20 * 60_000;
  chain.paid.add(first.voucher.claimId);
  const signedBefore = chain.signedCount();
  await rejects(() => ledger.beginClaim(receipt.id, ALICE, chain.adapter), 409);
  assert.equal(chain.signedCount(), signedBefore);
  assert.equal(ledger.getReceipt(receipt.id, ALICE).status, "claimed");
});

test("one transaction hash cannot settle two claims", async () => {
  const { ledger } = make(policy("1"));
  const chain = fakeChain();
  const a = ledger.createReceipt(ALICE, fields(), file()).receipt.id;
  const b = ledger.createReceipt(BOB, fields({ purchaseDate: "2026-09-22" }), file()).receipt.id;
  ledger.approve(a, ADMIN, "apple");
  ledger.approve(b, ADMIN, "apple");
  await ledger.beginClaim(a, ALICE, chain.adapter);
  await ledger.beginClaim(b, BOB, chain.adapter);
  const tx = `0x${"cc".repeat(32)}`;
  await ledger.syncClaim(a, ALICE, chain.adapter, tx);
  await rejects(() => ledger.syncClaim(b, BOB, chain.adapter, tx), 409);
});

test("deleting a receipt releases its reservation", () => {
  const { ledger } = make();
  const { receipt } = ledger.createReceipt(ALICE, fields(), file());
  ledger.approve(receipt.id, ADMIN, "apple");
  const removed = ledger.deleteReceipt(receipt.id, ALICE);
  assert.equal(removed.fileKey, `${receipt.id}.png`);
  assert.equal(ledger.committedUnits("test-aapl"), BigInt(0));
  assert.equal(ledger.listReceipts(ALICE).length, 0);
});

test("sign-in nonces are single use and expire", () => {
  const { ledger, clock } = make();
  const nonce = ledger.issueNonce();
  assert.equal(ledger.consumeNonce(nonce), true);
  assert.equal(ledger.consumeNonce(nonce), false);
  const late = ledger.issueNonce();
  clock.now += 11 * 60_000;
  assert.equal(ledger.consumeNonce(late), false);
});

test("receipt files leave storage after the retention period", () => {
  const { ledger, clock } = make();
  const { receipt } = ledger.createReceipt(ALICE, fields({ merchant: "Amazon" }), file());
  ledger.reject(receipt.id, ADMIN, "Amazon is the merchant, not Apple.");
  assert.equal(ledger.expiredFiles().length, 0);
  clock.now += 91 * 86_400_000;
  const expired = ledger.expiredFiles();
  assert.equal(expired.length, 1);
  ledger.markFileRemoved(expired[0].id);
  assert.equal(ledger.getReceipt(receipt.id, ALICE).hasFile, false);
  assert.equal(ledger.expiredFiles().length, 0);
});
