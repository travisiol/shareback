"use client";

import { useState } from "react";
import { companyByKey, matchMerchant } from "@/config/eligibility";
import { explorerTx } from "@/config/network";
import { STATUS_EXPLAINER } from "@/core/status";
import type { ReceiptView } from "@/core/types";
import { formatMoney } from "@/core/units";
import { ACTION_LABEL, formatDateTime, formatIsoDate } from "@/lib/format";
import { ApiError, liveStore, useLive } from "@/lib/live";
import { openWalletDialog, useWallet, walletErrorMessage } from "@/lib/wallet";
import { BrandMark } from "../BrandMark";
import { ExternalIcon, FileIcon, ReceiptIcon, TrashIcon } from "../icons";
import { ProgressTrack, StatusBadge } from "./StatusBits";

export function MerchantAvatar({ receipt, className = "size-12" }: { receipt: ReceiptView; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-2xl bg-cream ${className}`}>
      {receipt.companyKey ? (
        <BrandMark company={receipt.companyKey} className="size-[52%]" />
      ) : (
        <ReceiptIcon className="h-[55%] w-auto text-moss" strokeWidth={3} />
      )}
    </span>
  );
}

/** The reward as a small stock card — only ever rendered when a reward really is reserved. */
export function RewardCard({ receipt }: { receipt: ReceiptView }) {
  const reward = receipt.reward;
  if (!reward) return null;
  const claimed = reward.status === "claimed";
  return (
    <div
      className={`handoff grain relative overflow-hidden rounded-[22px] p-5 shadow-lift ${
        claimed ? "bg-lime text-forest" : "bg-forest text-paper"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {receipt.companyKey ? <BrandMark company={receipt.companyKey} className="size-7" /> : <span />}
        <span className="text-xs font-semibold">{claimed ? "Claimed" : "Reserved for you"}</span>
      </div>
      <p className={`mt-5 text-[1.9rem] leading-none font-extrabold ${claimed ? "" : "text-lime"}`}>
        +{reward.amount} {reward.tokenSymbol}
      </p>
      <p className="mt-1.5 text-sm font-medium opacity-85">Tokenized stock · quantity, not a cash value</p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "bad" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-[16px] px-4 py-3.5 text-[0.9375rem] leading-relaxed ${
        tone === "bad" ? "bg-clay-soft text-clay" : "bg-cream-deep text-forest"
      }`}
    >
      {children}
    </div>
  );
}

export function ReceiptDetail({ receipt, onDeleted }: { receipt: ReceiptView; onDeleted?: () => void }) {
  const live = useLive();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const company = companyByKey(receipt.companyKey);
  const match = matchMerchant(receipt.merchant);
  const preview = receipt.hasFile ? `/api/receipts/${receipt.id}/file` : null;
  const isImage = receipt.fileMime?.startsWith("image/");

  const run = async (action: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const claimsEnabled = live.config?.claims.enabled ?? false;
  const walletMatches = wallet.address !== null && wallet.address === live.session;
  const canDelete = receipt.status !== "claiming" && receipt.status !== "claimed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <MerchantAvatar receipt={receipt} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.375rem] leading-tight font-extrabold tracking-[-0.02em]">{receipt.merchant}</p>
          <p className="text-moss">
            {formatMoney(receipt.totalMinor, receipt.currency)} · {formatIsoDate(receipt.purchaseDate)}
          </p>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <ProgressTrack status={receipt.status} />

      <p className="text-[1.0625rem] leading-relaxed">{STATUS_EXPLAINER[receipt.status]}</p>

      {receipt.status === "rejected" && receipt.rejectReason && (
        <Notice tone="bad">
          <strong className="block">Why it was rejected</strong>
          {receipt.rejectReason}
        </Notice>
      )}

      {receipt.reward && <RewardCard receipt={receipt} />}

      {/* ── claim */}
      {receipt.status === "claimable" && (
        <div className="space-y-2">
          {!claimsEnabled ? (
            <Notice tone="info">
              <strong className="block">Your reward is reserved</strong>
              It will be sent to the wallet you signed in with.
            </Notice>
          ) : !walletMatches ? (
            <button type="button" className="btn btn-lime w-full" onClick={openWalletDialog}>
              Connect the wallet you signed in with
            </button>
          ) : (
            <button type="button" className="btn btn-lime w-full" disabled={busy} onClick={() => run(() => liveStore.claim(receipt.id))}>
              {busy && <span className="spinner" />}
              Claim to wallet
            </button>
          )}
        </div>
      )}
      {receipt.status === "claiming" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-honey px-4 py-3.5 text-[#5c4a07]">
          <span className="flex items-center gap-3 font-bold">
            <span className="spinner" />
            Waiting for the network to confirm
          </span>
          <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(() => liveStore.syncClaim(receipt.id))}>
            Check again
          </button>
        </div>
      )}
      {receipt.status === "claimed" && receipt.reward && (
        <p className="text-[0.9375rem] text-moss">
          {receipt.reward.txHash ? (
            <a href={explorerTx(receipt.reward.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold text-forest underline underline-offset-4">
              View the claim transaction <ExternalIcon className="size-4" />
            </a>
          ) : (
            "Confirmed on chain."
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-[14px] bg-clay-soft px-4 py-3 font-medium text-clay">
          {error}
        </p>
      )}

      {/* ── the file */}
      {preview && isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, per-user file; must not go through the image optimizer
        <img src={preview} alt={`Receipt from ${receipt.merchant}`} className="max-h-[26rem] w-full rounded-[18px] bg-paper object-contain shadow-soft" />
      ) : preview ? (
        <a href={preview} target="_blank" rel="noreferrer" className="card flex items-center gap-3 p-4 font-bold">
          <FileIcon className="size-6" /> Open {receipt.fileName ?? "receipt"} <ExternalIcon className="ml-auto size-4" />
        </a>
      ) : (
        <p className="card-flat flex items-center gap-3 p-4 text-sm text-moss">
          <FileIcon className="size-5 shrink-0" />
          The receipt file is no longer stored (retention period ended).
        </p>
      )}

      {/* ── fields */}
      <dl className="divide-y divide-line border-y border-line text-[0.9375rem]">
        {[
          ["Merchant", receipt.merchant],
          ["Purchase date", formatIsoDate(receipt.purchaseDate)],
          ["Total", formatMoney(receipt.totalMinor, receipt.currency)],
          [
            "Eligible company",
            company
              ? `${company.name}${company.tokenSymbol ? ` · ${company.tokenSymbol}` : " · token not configured"}`
              : match.kind === "third-party"
                ? "None — third-party seller"
                : "None matched",
          ],
          ["Details", "Entered manually"],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 py-3">
            <dt className="text-moss">{label}</dt>
            <dd className="text-right font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      {/* ── history */}
      <div>
        <p className="eyebrow mb-3">History</p>
        <ol className="space-y-3">
          {receipt.history.map((entry, index) => (
            <li key={index} className="flex gap-3 text-[0.9375rem]">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-forest" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-bold">{ACTION_LABEL[entry.action] ?? entry.action}</p>
                <p className="text-sm text-moss">
                  {formatDateTime(entry.at)} · {entry.actor}
                </p>
                {entry.note && entry.action !== "rejected" && <p className="text-sm break-words text-moss">{entry.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {canDelete &&
        (confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[16px] bg-clay-soft p-4">
            <p className="flex-1 text-[0.9375rem] font-medium text-clay">
              Delete this receipt, its file and any reserved reward? This cannot be undone.
            </p>
            <button
              type="button"
              className="btn btn-sm bg-clay text-paper"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await liveStore.remove(receipt.id);
                  onDeleted?.();
                })
              }
            >
              Delete
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </div>
        ) : (
          <button type="button" className="inline-flex items-center gap-2 rounded-md text-[0.9375rem] font-bold text-clay" onClick={() => setConfirmDelete(true)}>
            <TrashIcon className="size-4.5" /> Delete receipt
          </button>
        ))}
    </div>
  );
}
