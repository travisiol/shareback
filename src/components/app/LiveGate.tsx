"use client";

import { useState } from "react";
import { REVIEW_PROMISE, REWARD_PROMISE } from "@/config/service";
import { ApiError, liveStore, useLive } from "@/lib/live";
import { openWalletDialog, shortAddress, useWallet, walletErrorMessage } from "@/lib/wallet";
import { CheckIcon, InfoIcon } from "../icons";

function Line({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${ok ? "bg-forest text-lime" : "bg-honey text-[#5c4a07]"}`}
      >
        {ok ? <CheckIcon className="size-3" strokeWidth={3.4} /> : <InfoIcon className="size-3.5" />}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** How it works, in three lines. */
export function Readiness() {
  const live = useLive();
  const config = live.config;
  if (!config) return null;
  return (
    <ul className="space-y-2.5 text-[0.9375rem] leading-snug">
      {!config.signIn && <Line ok={false}>Sign-in is not configured on this server.</Line>}
      <Line ok>Connect your wallet, then upload a photo or PDF of your receipt.</Line>
      <Line ok>{REVIEW_PROMISE}</Line>
      <Line ok>{REWARD_PROMISE}</Line>
    </ul>
  );
}

export function LiveGate({ title }: { title: string }) {
  const live = useLive();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!wallet.address) return openWalletDialog();
    setBusy(true);
    setError(null);
    try {
      await liveStore.signIn(wallet.address);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mx-auto max-w-[40rem] p-[clamp(1.5rem,4vw,2.5rem)]">
      <h1 className="display text-[clamp(2rem,4vw,2.75rem)]">{title}</h1>
      <p className="mt-4 text-[1.0625rem] leading-relaxed text-moss">
        Your receipts are stored privately and tied to your wallet address, so we ask you to sign a one-time message. It
        costs no gas and moves no funds.
      </p>

      <div className="card-flat mt-6 p-5">
        {live.ready ? <Readiness /> : <p className="text-moss">Checking…</p>}
        {live.error && !live.config && (
          <p role="alert" className="mt-3 font-medium text-clay">
            {live.error}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-[14px] bg-clay-soft px-4 py-3 font-medium text-clay">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-lime mt-6" disabled={busy || !live.config?.signIn} onClick={signIn}>
        {busy && <span className="spinner" />}
        {wallet.address ? `Sign in as ${shortAddress(wallet.address)}` : "Connect wallet"}
      </button>
    </section>
  );
}
