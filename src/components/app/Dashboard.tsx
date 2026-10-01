"use client";

import Link from "next/link";
import { useState } from "react";
import { companyByKey } from "@/config/eligibility";
import { explorerTx } from "@/config/network";
import type { ReceiptView } from "@/core/types";
import { formatMoney, formatUnits, parseUnits } from "@/core/units";
import { formatDate, formatIsoDate } from "@/lib/format";
import { useLive } from "@/lib/live";
import { BrandMark } from "../BrandMark";
import { Modal } from "../Modal";
import { ArrowRight, ExternalIcon, UploadIcon } from "../icons";
import { LiveGate } from "./LiveGate";
import { MerchantAvatar, ReceiptDetail } from "./ReceiptDetail";
import { StatusBadge } from "./StatusBits";

/** Sum decimal token quantities exactly. */
function sum(amounts: string[]): string {
  return formatUnits(
    amounts.reduce((total, amount) => total + parseUnits(amount, 18), BigInt(0)),
    18,
  );
}

function EmptyReceipts() {
  return (
    <div className="card grid place-items-center px-6 py-[clamp(3rem,8vw,5rem)] text-center">
      <svg viewBox="0 0 120 130" className="h-28 w-auto" aria-hidden="true">
        <path
          d="M22 12h76v104l-9.500-7-9.500 7-9.500-7-9.500 7-9.500-7-9.500 7-9.500-7-9.500 7V12Z"
          fill="#fffdf8"
          stroke="#1b2a4a"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeDasharray="7 7"
        />
        <circle cx="60" cy="58" r="17" fill="#ffc857" />
        <path d="M60 50v16M52 58h16" stroke="#1b2a4a" strokeWidth="3.500" strokeLinecap="round" />
      </svg>
      <h2 className="mt-6 text-[1.75rem] font-extrabold tracking-[-0.02em]">No receipts yet</h2>
      <p className="mt-2 max-w-[26rem] text-[1.0625rem] leading-relaxed text-moss">
        Upload a receipt from an eligible company and it will show up here with its status.
      </p>
      <Link href="/app" className="btn btn-lime mt-6">
        <UploadIcon className="size-5" /> Upload receipt
      </Link>
    </div>
  );
}

function ReceiptRow({ receipt, onOpen }: { receipt: ReceiptView; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="card flex w-full flex-wrap items-center gap-x-4 gap-y-3 p-4 text-left transition-transform hover:-translate-y-0.5 sm:p-5"
      >
        <MerchantAvatar receipt={receipt} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.125rem] font-extrabold tracking-[-0.01em]">{receipt.merchant}</span>
          <span className="block text-[0.9375rem] text-moss">
            {formatMoney(receipt.totalMinor, receipt.currency)} · {formatIsoDate(receipt.purchaseDate)}
          </span>
          {receipt.reward && (
            <span className="mt-0.5 block font-mono text-[0.875rem] font-medium sm:hidden">
              +{receipt.reward.amount} {receipt.reward.tokenSymbol}
            </span>
          )}
        </span>
        {receipt.reward && (
          <span className="hidden font-mono text-[0.9375rem] font-medium sm:inline">
            +{receipt.reward.amount} {receipt.reward.tokenSymbol}
          </span>
        )}
        <StatusBadge status={receipt.status} />
        <ArrowRight className="hidden size-5 text-sage sm:block" />
      </button>
    </li>
  );
}

export default function Dashboard() {
  const live = useLive();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!live.ready) return <p className="text-moss">Loading your receipts…</p>;
  if (!live.session) return <LiveGate title="Sign in to see your receipts" />;

  const receipts = live.receipts;
  const open = receipts.find((r) => r.id === openId) ?? null;

  const claimable = receipts.filter((r) => r.status === "claimable" || r.status === "claiming");
  const claimed = receipts.filter((r) => r.status === "claimed" && r.reward);
  const pending = receipts.filter((r) => r.status === "submitted" || r.status === "under_review").length;

  const byCompany = new Map<string, { companyKey: string | null; symbol: string; amounts: string[]; count: number }>();
  for (const receipt of claimed) {
    const symbol = receipt.reward!.tokenSymbol;
    const group = byCompany.get(symbol) ?? { companyKey: receipt.companyKey, symbol, amounts: [], count: 0 };
    group.amounts.push(receipt.reward!.amount);
    group.count++;
    byCompany.set(symbol, group);
  }

  const history = receipts
    .filter((r) => r.reward)
    .map((r) => ({ receipt: r, reward: r.reward!, at: r.reward!.claimedAt ?? r.updatedAt }))
    .sort((a, b) => b.at - a.at);

  return (
    <div className="space-y-[clamp(2.5rem,5vw,4rem)]">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display text-[clamp(2.4rem,5vw,3.75rem)]">Your receipts.</h1>
          <p className="mt-3 text-[1.125rem] text-moss">
            {receipts.length === 0
              ? "Nothing here yet."
              : `${receipts.length} receipt${receipts.length === 1 ? "" : "s"} · ${pending} in review · ${claimable.length} to claim`}
          </p>
        </div>
        <Link href="/app" className="btn btn-lime btn-xl">
          <UploadIcon className="size-6" /> Upload receipt
        </Link>
      </div>

      {live.error && (
        <p role="alert" className="rounded-[14px] bg-clay-soft px-4 py-3 font-medium text-clay">
          {live.error}
        </p>
      )}

      {receipts.length === 0 ? (
        <EmptyReceipts />
      ) : (
        <>
          {/* ── rewards */}
          <section className="grid gap-5 lg:grid-cols-2" aria-label="Rewards">
            <div className="on-forest grain rounded-[28px] bg-forest p-6 text-paper sm:p-7">
              <p className="text-[0.8125rem] font-bold tracking-[0.08em] text-lime uppercase">Claimable rewards</p>
              {claimable.length === 0 ? (
                <p className="mt-4 text-[1.0625rem] leading-relaxed text-paper/75">
                  Nothing to claim right now. A reward appears here once it is funded and reserved for one of your
                  receipts.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {claimable.map((receipt) => (
                    <li key={receipt.id} className="flex flex-wrap items-center gap-3 rounded-[18px] bg-forest-soft p-4">
                      {receipt.companyKey && <BrandMark company={receipt.companyKey} className="size-7 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[1.375rem] leading-tight font-extrabold text-lime">
                          +{receipt.reward?.amount} {receipt.reward?.tokenSymbol}
                        </p>
                        <p className="truncate text-sm text-paper/70">Tokenized stock · {receipt.merchant}</p>
                      </div>
                      <button type="button" className="btn btn-lime btn-sm" onClick={() => setOpenId(receipt.id)}>
                        {receipt.status === "claiming" ? "View claim" : "Claim"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card p-6 sm:p-7">
              <p className="eyebrow">Claimed, by company</p>
              {byCompany.size === 0 ? (
                <p className="mt-4 text-[1.0625rem] leading-relaxed text-moss">
                  No claimed rewards yet. Claimed tokens are grouped here by company.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-line">
                  {[...byCompany.values()].map((group) => (
                    <li key={group.symbol} className="flex items-center gap-4 py-3.5">
                      <span className="grid size-12 place-items-center rounded-2xl bg-cream">
                        {group.companyKey && <BrandMark company={group.companyKey} className="size-6" />}
                      </span>
                      <div className="flex-1">
                        <p className="text-[1.125rem] font-extrabold">{companyByKey(group.companyKey)?.name ?? group.symbol}</p>
                        <p className="text-sm text-moss">
                          {group.count} reward{group.count === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="font-mono text-[1.0625rem] font-medium">
                        {sum(group.amounts)} {group.symbol}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-sm leading-relaxed text-moss">
                Shown as token quantities. No price source is connected, so no monetary value is estimated.
              </p>
            </div>
          </section>

          {/* ── receipts */}
          <section aria-label="Receipts">
            <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em]">All receipts</h2>
            <ul className="mt-4 space-y-3">
              {receipts.map((receipt) => (
                <ReceiptRow key={receipt.id} receipt={receipt} onOpen={() => setOpenId(receipt.id)} />
              ))}
            </ul>
          </section>

          {/* ── reward and transaction history */}
          <section aria-label="Reward history">
            <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em]">Reward history</h2>
            {history.length === 0 ? (
              <p className="card-flat mt-4 p-5 text-moss">No rewards have been reserved or claimed yet.</p>
            ) : (
              <ul className="card mt-4 divide-y divide-line px-5">
                {history.map(({ receipt, reward, at }) => (
                  <li key={reward.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 py-4 text-[0.9375rem]">
                    <span className="w-28 text-moss">{formatDate(at)}</span>
                    <span className="min-w-0 flex-1 font-bold">
                      {reward.status === "claimed" ? "Claimed" : reward.status === "claiming" ? "Claim pending" : "Reserved"} ·{" "}
                      {receipt.merchant}
                    </span>
                    <span className="font-mono font-medium">
                      +{reward.amount} {reward.tokenSymbol}
                    </span>
                    <span className="w-full text-sm text-moss sm:w-44 sm:text-right">
                      {reward.txHash ? (
                        <a href={explorerTx(reward.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-forest underline underline-offset-4">
                          Transaction <ExternalIcon className="size-3.5" />
                        </a>
                      ) : (
                        "No transaction yet"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Modal open={open !== null} onClose={() => setOpenId(null)} title="Receipt" variant="drawer">
        {open && <ReceiptDetail receipt={open} onDeleted={() => setOpenId(null)} />}
      </Modal>
    </div>
  );
}
