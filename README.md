# shareback

Turn eligible shopping receipts into tokenized stock rewards in the company you bought from.

Buy from an eligible company → upload the receipt → once the purchase is verified and a reward is funded, claim a
tokenized stock reward (for example AAPL for an Apple Store receipt).

Rewards come from SHAREBACK's own reward pool. Brands are not partners or sponsors. A reward is a tokenized stock
token on Robinhood Chain, not a conventional share, and there is no fixed rate.

## Run it

```bash
npm install
npm run dev        # http://localhost:3621
```

Requires Node 22.13+ (uses the built-in `node:sqlite`).

```bash
npm test                        # 21 ledger / policy / validation tests
node scripts/verify-api.mjs     # 13 end-to-end checks against the running server
npm run lint
npm run build
```

Copy `.env.example` to `.env.local` and set `ADMIN_SECRET` (16+ characters) to use `/admin`.

## How it runs

There is no demo data. Users connect a wallet, sign a one-time message, upload a receipt, and a reviewer at
`/admin` approves or rejects it. Records live in SQLite with private file storage. A reward only appears once a
funded campaign in the reward policy has budget for it; on-chain claims stay closed until a reward contract is
deployed.

## Where things live

```
src/config/
  network.ts         chain, token addresses, reward contract address — the only place
  eligibility.ts     merchant → company rules (the seller qualifies, not product brands)
  reward-policy.ts   campaigns, tiers, caps, budgets, per-user limits
  uploads.ts         file types, size limit, retention
src/core/            pure logic, no framework: status model, validation, reward decision, ledger (SQLite)
src/server/          sessions, private storage, claim adapter (viem), HTTP helpers
src/lib/             browser side: wallet (EIP-6963), API client
src/app/api/         route handlers
src/components/      UI
tests/               node:test suite for src/core
```

## Receipt states

`draft → submitted → under_review → approved | rejected`, then `approved → claimable → claiming → claimed`.

Approved is not claimable. A receipt becomes claimable only when its reward quantity has been reserved inside a
campaign budget, in the same database transaction. Reserved + paid can never exceed the budget.

## Privacy

- File type is checked from the bytes on the server (JPEG, PNG, PDF; 8 MB).
- Files are stored outside `public/` and served only to their owner or a signed-in reviewer, with `no-store`.
- Raw receipt contents are never logged, and nothing about a purchase goes on-chain — the contract sees a random
  claim id, a recipient, a token and an amount.
- Retention: the file is deleted 90 days after a final decision; a user can delete a receipt any time before a claim.
- A SHA-256 of the file and the normalized merchant/date/total flag likely duplicates for the reviewer. A flag is a
  prompt to look closer, not proof.

## What live rewards still need

1. **A reward contract** implementing `src/lib/reward-vault-abi.ts` (EIP-712 signed claim, expiry, one payout per
   claim id, `msg.sender == recipient`). None exists yet. Set `NEXT_PUBLIC_REWARD_VAULT_ADDRESS`.
2. **A reward signer key** the contract trusts: `REWARD_SIGNER_PRIVATE_KEY` (server only).
3. **A funded campaign** in `LIVE_POLICY` (`src/config/reward-policy.ts`) whose budget matches what the contract holds.
4. **Confirm the token addresses** in `src/config/network.ts` against the official Robinhood Chain token list. They were
   read on-chain (name/symbol/decimals), not taken from that page.
5. **Production hosting**: `SESSION_SECRET`, `ADMIN_SECRET`, and a persistent disk (`SHAREBACK_DATA_DIR`) or a swap of
   `src/server/storage.ts` / `db.ts` for an object store and a hosted database. On serverless hosts the default
   storage is temporary and the app says so.
6. **Optional**: an OCR provider. Today the user types merchant, date and total; the UI states that nothing was
   extracted.
7. **Legal review** of distributing tokenized stock as rewards in the regions you serve.

The on-chain claim adapter (`src/server/claims.ts`) is written but has never run against a contract. The claim state
machine it plugs into is covered by tests with a fake chain.
