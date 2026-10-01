// End-to-end checks against a running server (default http://localhost:3621).
// Uses two throwaway wallets and the reviewer password from .env.local.
// Leaves no records behind.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = process.env.BASE_URL || "http://localhost:3621";
const adminSecret = /^ADMIN_SECRET=(.+)$/m.exec(readFileSync(".env.local", "utf8"))?.[1]?.trim();

function client() {
  const jar = new Map();
  return async (path, init = {}) => {
    const headers = { origin: BASE, ...(init.headers ?? {}) };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const response = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const [name, value] = pair.split("=");
      if (value) jar.set(name, value);
      else jar.delete(name);
    }
    const type = response.headers.get("content-type") ?? "";
    return { status: response.status, body: type.includes("json") ? await response.json() : null, headers: response.headers };
  };
}

const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function signIn(http, account) {
  const nonce = await http("/api/auth/nonce", json("POST", { address: account.address }));
  assert.equal(nonce.status, 200);
  const signature = await account.signMessage({ message: nonce.body.message });
  const verify = await http(
    "/api/auth/verify",
    json("POST", { address: account.address, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt, signature }),
  );
  return { verify, nonce: nonce.body, signature };
}

// A valid 1×1 PNG, made unique per run so the daily duplicate rule does not interfere.
function png(seed) {
  const base = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  return Buffer.concat([base, Buffer.from(seed)]);
}

function form(bytes, type, name, fields) {
  const data = new FormData();
  data.set("file", new Blob([bytes], { type }), name);
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

const today = new Date();
const daysAgo = (n) => new Date(today - n * 86_400_000).toISOString().slice(0, 10);
const good = { merchant: "Apple Store", purchaseDate: daysAgo(3), totalMinor: 129700, currency: "USD" };

const results = [];
const check = async (name, fn) => {
  await fn();
  results.push(name);
  console.log("ok  -", name);
};

const alice = privateKeyToAccount(generatePrivateKey());
const bob = privateKeyToAccount(generatePrivateKey());
const a = client();
const b = client();
const anon = client();
const admin = client();
const seed = `run-${Date.now()}`;
let receiptId;

await check("anonymous requests cannot list, upload or read receipts", async () => {
  assert.equal((await anon("/api/receipts")).status, 401);
  assert.equal((await anon("/api/receipts", { method: "POST", body: form(png(seed), "image/png", "r.png", good) })).status, 401);
  assert.equal((await anon("/api/receipts/r_000000000000000000")).status, 401);
  assert.equal((await anon("/api/receipts/r_000000000000000000/file")).status, 401);
});

await check("cross-site mutations are refused", async () => {
  const response = await fetch(BASE + "/api/auth/nonce", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ address: alice.address }),
  });
  assert.equal(response.status, 403);
});

await check("a signature from another wallet does not open a session", async () => {
  const nonce = await b("/api/auth/nonce", json("POST", { address: alice.address }));
  const signature = await bob.signMessage({ message: nonce.body.message });
  const verify = await b(
    "/api/auth/verify",
    json("POST", { address: alice.address, nonce: nonce.body.nonce, issuedAt: nonce.body.issuedAt, signature }),
  );
  assert.equal(verify.status, 401);
  assert.equal((await b("/api/receipts")).status, 401);
});

await check("wallet sign-in works, and a used nonce cannot be replayed", async () => {
  const first = await signIn(a, alice);
  assert.equal(first.verify.status, 200);
  const replay = await anon(
    "/api/auth/verify",
    json("POST", { address: alice.address, nonce: first.nonce.nonce, issuedAt: first.nonce.issuedAt, signature: first.signature }),
  );
  assert.equal(replay.status, 401);
  assert.equal((await signIn(b, bob)).verify.status, 200);
  assert.equal((await a("/api/auth/me")).body.address, alice.address.toLowerCase());
});

await check("invalid uploads are rejected on the server", async () => {
  const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'/>");
  const disguised = await a("/api/receipts", { method: "POST", body: form(svg, "image/png", "receipt.png", good) });
  assert.equal(disguised.status, 415);
  const exe = await a("/api/receipts", { method: "POST", body: form(Buffer.from("MZ\x90\x00binary"), "application/pdf", "receipt.pdf", good) });
  assert.equal(exe.status, 415);
  const empty = await a("/api/receipts", { method: "POST", body: form(Buffer.alloc(0), "image/png", "empty.png", good) });
  assert.equal(empty.status, 415);
  const huge = Buffer.concat([png(seed), Buffer.alloc(9 * 1024 * 1024)]);
  const tooBig = await a("/api/receipts", { method: "POST", body: form(huge, "image/png", "big.png", good) });
  assert.equal(tooBig.status, 413);
  const oldDate = await a("/api/receipts", { method: "POST", body: form(png(seed), "image/png", "r.png", { ...good, purchaseDate: daysAgo(90) }) });
  assert.equal(oldDate.status, 422);
  assert.ok(oldDate.body.fields.purchaseDate);
  const badTotal = await a("/api/receipts", { method: "POST", body: form(png(seed), "image/png", "r.png", { ...good, totalMinor: -5 }) });
  assert.equal(badTotal.status, 422);
  assert.equal((await a("/api/receipts")).body.receipts.length, 0);
});

await check("a valid receipt is stored, and re-sending it does not duplicate it", async () => {
  const created = await a("/api/receipts", { method: "POST", body: form(png(seed), "image/png", "receipt.png", good) });
  assert.equal(created.status, 201);
  assert.equal(created.body.receipt.status, "submitted");
  assert.equal(created.body.receipt.companyKey, "apple");
  assert.equal(created.body.receipt.reward, null);
  receiptId = created.body.receipt.id;
  const again = await a("/api/receipts", { method: "POST", body: form(png(seed), "image/png", "receipt.png", good) });
  assert.equal(again.status, 200);
  assert.equal(again.body.receipt.id, receiptId);
  assert.equal((await a("/api/receipts")).body.receipts.length, 1);
});

await check("another user cannot see, download, delete or claim it", async () => {
  assert.equal((await b(`/api/receipts/${receiptId}`)).status, 404);
  assert.equal((await b(`/api/receipts/${receiptId}/file`)).status, 404);
  assert.equal((await b(`/api/receipts/${receiptId}`, { method: "DELETE" })).status, 404);
  assert.notEqual((await b(`/api/receipts/${receiptId}/claim`, { method: "POST" })).status, 200);
  assert.equal((await b("/api/receipts")).body.receipts.length, 0);
});

await check("the owner gets the file back, privately", async () => {
  const file = await a(`/api/receipts/${receiptId}/file`);
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.match(file.headers.get("cache-control"), /no-store/);
  // Not reachable as a static asset either.
  assert.equal((await anon(`/data/receipts/${receiptId}.png`)).status, 404);
  assert.equal((await anon(`/receipts/${receiptId}.png`)).status, 404);
});

await check("review endpoints refuse users and anonymous callers", async () => {
  for (const http of [anon, a, b]) {
    const list = await http("/api/admin/receipts");
    assert.equal(list.body.authenticated, false);
    assert.equal(list.body.receipts, undefined);
    assert.equal((await http(`/api/admin/receipts/${receiptId}`, json("POST", { action: "approve", companyKey: "apple" }))).status, 401);
    assert.equal((await http(`/api/admin/receipts/${receiptId}`, json("POST", { action: "reject", reason: "not a real reason" }))).status, 401);
    assert.equal((await http(`/api/admin/receipts/${receiptId}/file`)).status, 401);
  }
  assert.equal((await a(`/api/receipts/${receiptId}`)).body.receipt.status, "submitted");
  assert.equal((await anon("/api/admin/login", json("POST", { password: "wrong-password-guess" }))).status, 401);
});

await check("a reviewer can approve once; approval alone creates no reward", async () => {
  assert.ok(adminSecret, "ADMIN_SECRET missing from .env.local");
  assert.equal((await admin("/api/admin/login", json("POST", { password: adminSecret }))).status, 200);
  const list = await admin("/api/admin/receipts");
  assert.equal(list.body.authenticated, true);
  assert.ok(list.body.receipts.some((r) => r.id === receiptId));
  const approved = await admin(`/api/admin/receipts/${receiptId}`, json("POST", { action: "approve", companyKey: "apple" }));
  assert.equal(approved.status, 200);
  // No live campaign is funded, so the receipt is approved but not claimable.
  assert.equal(approved.body.receipt.status, "approved");
  assert.equal(approved.body.receipt.reward, null);
  const replay = await admin(`/api/admin/receipts/${receiptId}`, json("POST", { action: "approve", companyKey: "apple" }));
  assert.equal(replay.status, 409);
  const retry = await admin(`/api/admin/receipts/${receiptId}`, json("POST", { action: "reserve" }));
  assert.equal(retry.body.receipt.reward, null);
});

await check("claims cannot be started: none is reserved and live claims are off", async () => {
  const claim = await a(`/api/receipts/${receiptId}/claim`, { method: "POST" });
  assert.equal(claim.status, 503);
  const sync = await a(`/api/receipts/${receiptId}/claim`, json("PUT", { txHash: `0x${"ab".repeat(32)}` }));
  assert.equal(sync.status, 503);
  assert.equal((await a(`/api/receipts/${receiptId}`)).body.receipt.status, "approved");
});

await check("the owner can delete the receipt and its file", async () => {
  assert.equal((await a(`/api/receipts/${receiptId}`, { method: "DELETE" })).status, 200);
  assert.equal((await a(`/api/receipts/${receiptId}`)).status, 404);
  assert.equal((await a(`/api/receipts/${receiptId}/file`)).status, 404);
  assert.equal((await admin(`/api/admin/receipts/${receiptId}/file`)).status, 404);
});

await check("signing out ends the session", async () => {
  assert.equal((await a("/api/auth/logout", { method: "POST" })).status, 200);
  assert.equal((await a("/api/receipts")).status, 401);
  await admin("/api/admin/logout", { method: "POST" });
  assert.equal((await admin("/api/admin/receipts")).body.authenticated, false);
});

console.log(`\n${results.length} checks passed against ${BASE}`);
