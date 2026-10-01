"use client";

/**
 * Client for the session, server config and the receipts API. A failure is
 * shown as a failure — there is no placeholder data.
 */
import { encodeFunctionData } from "viem";
import type { LiveStatus } from "@/app/api/config/route";
import { REWARD_VAULT_ADDRESS } from "@/config/network";
import type { FieldErrors } from "@/core/fields";
import type { ClaimVoucher, ReceiptFields, ReceiptView } from "@/core/types";
import { useSyncExternalStore } from "react";
import { REWARD_VAULT_ABI } from "./reward-vault-abi";
import { ensureChain, sendTransaction, signMessage } from "./wallet";

export interface LiveState {
  ready: boolean;
  config: LiveStatus | null;
  session: string | null;
  receipts: ReceiptView[];
  error: string | null;
}

const INITIAL: LiveState = { ready: false, config: null, session: null, receipts: [], error: null };
let state = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<LiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export class ApiError extends Error {
  status: number;
  fields?: FieldErrors;
  constructor(status: number, message: string, fields?: FieldErrors) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string; fields?: FieldErrors };
  if (!response.ok) {
    if (response.status === 401 && state.session) set({ session: null, receipts: [] });
    throw new ApiError(response.status, body.error ?? "The request failed.", body.fields);
  }
  return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

function replace(receipt: ReceiptView) {
  const exists = state.receipts.some((r) => r.id === receipt.id);
  set({ receipts: exists ? state.receipts.map((r) => (r.id === receipt.id ? receipt : r)) : [receipt, ...state.receipts] });
}

async function refresh() {
  if (!state.session) return;
  try {
    const { receipts } = await api<{ receipts: ReceiptView[] }>("/api/receipts");
    set({ receipts, error: null });
  } catch (error) {
    set({ error: (error as Error).message });
  }
}

async function boot() {
  try {
    const [config, me] = await Promise.all([
      api<LiveStatus>("/api/config"),
      api<{ address: string | null }>("/api/auth/me"),
    ]);
    set({ config, session: me.address, ready: true, error: null });
    await refresh();
  } catch (error) {
    set({ ready: true, error: (error as Error).message });
  }
}

export const liveStore = {
  subscribe(listener: () => void) {
    if (!started && typeof window !== "undefined") {
      started = true;
      void boot();
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => state,
  serverSnapshot: () => INITIAL,
  refresh,

  /** Prove control of the connected wallet by signing a one-time message. */
  async signIn(address: string) {
    const { nonce, issuedAt, message } = await api<{ nonce: string; issuedAt: string; message: string }>(
      "/api/auth/nonce",
      json("POST", { address }),
    );
    const signature = await signMessage(message);
    const { address: session } = await api<{ address: string }>(
      "/api/auth/verify",
      json("POST", { address, nonce, issuedAt, signature }),
    );
    set({ session });
    await refresh();
  },

  async signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    set({ session: null, receipts: [] });
  },

  async submit(fields: ReceiptFields, file: File): Promise<{ receipt: ReceiptView; created: boolean }> {
    const form = new FormData();
    form.set("file", file);
    form.set("merchant", fields.merchant);
    form.set("purchaseDate", fields.purchaseDate);
    form.set("totalMinor", String(fields.totalMinor));
    form.set("currency", fields.currency);
    const result = await api<{ receipt: ReceiptView; created: boolean }>("/api/receipts", { method: "POST", body: form });
    replace(result.receipt);
    return result;
  },

  async remove(id: string) {
    await api(`/api/receipts/${id}`, { method: "DELETE" });
    set({ receipts: state.receipts.filter((r) => r.id !== id) });
  },

  /**
   * Claim on chain. The server signs an authorization; the wallet sends it
   * to the reward contract; the server marks the reward claimed only after
   * it has seen the confirmed transaction itself.
   */
  async claim(id: string) {
    if (!REWARD_VAULT_ADDRESS || !state.config?.claims.enabled) throw new ApiError(503, "Live claims are not enabled.");
    const { voucher, receipt } = await api<{ voucher: ClaimVoucher; receipt: ReceiptView }>(
      `/api/receipts/${id}/claim`,
      { method: "POST" },
    );
    replace(receipt);
    await ensureChain();
    const data = encodeFunctionData({
      abi: REWARD_VAULT_ABI,
      functionName: "claim",
      args: [voucher.claimId, voucher.recipient, voucher.token, BigInt(voucher.amount), BigInt(voucher.expiry), voucher.signature],
    });
    const txHash = await sendTransaction(REWARD_VAULT_ADDRESS, data);
    const reported = await api<{ receipt: ReceiptView }>(`/api/receipts/${id}/claim`, json("PUT", { txHash }));
    replace(reported.receipt);
  },

  /** Ask the server to re-check a pending claim against the chain. */
  async syncClaim(id: string) {
    const { receipt } = await api<{ receipt: ReceiptView }>(`/api/receipts/${id}/claim`, json("PUT", {}));
    replace(receipt);
  },
};

export function useLive(): LiveState {
  return useSyncExternalStore(liveStore.subscribe, liveStore.snapshot, liveStore.serverSnapshot);
}
