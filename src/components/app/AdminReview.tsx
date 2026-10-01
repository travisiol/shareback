"use client";

import { useCallback, useEffect, useState } from "react";
import { COMPANIES, matchMerchant } from "@/config/eligibility";
import type { AdminReceiptView } from "@/core/ledger";
import { STATUS_LABEL } from "@/core/status";
import { formatMoney } from "@/core/units";
import { ACTION_LABEL, formatBytes, formatDateTime, formatIsoDate } from "@/lib/format";
import { shortAddress } from "@/lib/wallet";
import { ExternalIcon } from "../icons";
import { StatusBadge } from "./StatusBits";

interface CampaignRow {
  id: string;
  companyKey: string;
  tokenSymbol: string;
  active: boolean;
  budget: string;
  committed: string;
  available: string;
}

interface Queue {
  configured: boolean;
  authenticated: boolean;
  receipts?: AdminReceiptView[];
  campaigns?: CampaignRow[];
}

const FLAG_LABEL: Record<string, string> = {
  identical_file_other_account: "Identical file submitted by another account",
  matching_merchant_date_total: "Same merchant, date and total as another receipt",
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

function ReviewCard({ receipt, onChanged }: { receipt: AdminReceiptView; onChanged: () => void }) {
  const match = matchMerchant(receipt.merchant);
  const [companyKey, setCompanyKey] = useState(receipt.companyKey ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = receipt.status === "submitted" || receipt.status === "under_review";

  const act = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      await call(`/api/admin/receipts/${receipt.id}`, body);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[1.375rem] font-extrabold tracking-[-0.02em]">{receipt.merchant}</p>
          <p className="text-moss">
            {formatMoney(receipt.totalMinor, receipt.currency)} · purchased {formatIsoDate(receipt.purchaseDate)} · submitted{" "}
            {formatDateTime(receipt.createdAt)}
          </p>
          <p className="mt-1 font-mono text-sm text-moss">account {shortAddress(receipt.owner)}</p>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3 text-[0.9375rem]">
          <p>
            <span className="text-moss">Merchant rule: </span>
            <strong>
              {match.kind === "eligible"
                ? `matches ${match.company.name}`
                : match.kind === "third-party"
                  ? "third-party seller — product brands do not qualify"
                  : "no eligible company matched"}
            </strong>
          </p>
          <p>
            <span className="text-moss">Fields: </span>
            <strong>entered by the user</strong> (no automatic extraction)
          </p>
          {receipt.duplicateFlags.length > 0 ? (
            <ul className="rounded-[14px] bg-honey px-4 py-3 text-[#5c4a07]">
              {receipt.duplicateFlags.map((flag) => (
                <li key={flag} className="font-bold">
                  ⚑ {FLAG_LABEL[flag] ?? flag}
                </li>
              ))}
              <li className="mt-1 text-sm font-normal">A flag is a prompt to look closer, not proof of fraud.</li>
            </ul>
          ) : (
            <p className="text-moss">No duplicate flags.</p>
          )}
          {receipt.hasFile ? (
            <a
              href={`/api/admin/receipts/${receipt.id}/file`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-bold underline underline-offset-4"
            >
              Open receipt file ({receipt.fileMime}, {formatBytes(receipt.fileSize ?? 0)}) <ExternalIcon className="size-4" />
            </a>
          ) : (
            <p className="text-moss">File removed under the retention policy.</p>
          )}
          {receipt.reward && (
            <p>
              <span className="text-moss">Reward: </span>
              <strong className="font-mono">
                {receipt.reward.amount} {receipt.reward.tokenSymbol}
              </strong>{" "}
              ({receipt.reward.status})
            </p>
          )}
          {receipt.fundingNote && <p className="text-clay">Not reserved: {receipt.fundingNote}</p>}
          {receipt.rejectReason && <p className="text-clay">Rejected: {receipt.rejectReason}</p>}
        </div>

        <div>
          <p className="eyebrow mb-2">Audit trail</p>
          <ol className="space-y-1.5 text-sm">
            {receipt.history.map((entry, index) => (
              <li key={index}>
                <span className="text-moss">{formatDateTime(entry.at)}</span> · <strong>{ACTION_LABEL[entry.action] ?? entry.action}</strong>{" "}
                <span className="text-moss">
                  by {entry.actor.startsWith("0x") ? shortAddress(entry.actor) : entry.actor}
                  {entry.to ? ` → ${STATUS_LABEL[entry.to]}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {open && (
        <div className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block font-bold" htmlFor={`company-${receipt.id}`}>
              Approve as a purchase from
            </label>
            <div className="flex gap-2">
              <select id={`company-${receipt.id}`} className="field" value={companyKey} onChange={(e) => setCompanyKey(e.target.value)}>
                <option value="">Choose a company…</option>
                {COMPANIES.map((company) => (
                  <option key={company.key} value={company.key}>
                    {company.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-lime" disabled={busy || !companyKey} onClick={() => act({ action: "approve", companyKey })}>
                Approve
              </button>
            </div>
            <p className="mt-1.5 text-sm text-moss">Approval verifies the purchase. A reward is reserved only if a funded campaign has budget.</p>
          </div>
          <div>
            <label className="mb-2 block font-bold" htmlFor={`reason-${receipt.id}`}>
              Reject with a reason the user will see
            </label>
            <div className="flex gap-2">
              <input
                id={`reason-${receipt.id}`}
                className="field"
                placeholder="e.g. The total does not match the receipt."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button type="button" className="btn btn-quiet" disabled={busy || reason.trim().length < 8} onClick={() => act({ action: "reject", reason })}>
                Reject
              </button>
            </div>
          </div>
          {receipt.status === "submitted" && (
            <button type="button" className="btn btn-quiet btn-sm justify-self-start" disabled={busy} onClick={() => act({ action: "start" })}>
              Mark as under review
            </button>
          )}
        </div>
      )}
      {receipt.status === "approved" && (
        <button type="button" className="btn btn-quiet btn-sm mt-4" disabled={busy} onClick={() => act({ action: "reserve" })}>
          Retry reward reservation
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 font-medium text-clay">
          {error}
        </p>
      )}
    </li>
  );
}

export default function AdminReview() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    call<Queue>("/api/admin/receipts")
      .then(setQueue)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  if (!queue) return <p className="text-moss">{error ?? "Loading…"}</p>;

  if (!queue.configured) {
    return (
      <div className="card mx-auto max-w-[36rem] p-8">
        <h1 className="display text-[2.25rem]">Review is not configured.</h1>
        <p className="mt-4 leading-relaxed text-moss">
          Set <code className="font-mono text-forest">ADMIN_SECRET</code> (16+ characters) and, in production,{" "}
          <code className="font-mono text-forest">SESSION_SECRET</code> on the server, then reload. Until then nobody can
          approve or reject receipts.
        </p>
      </div>
    );
  }

  if (!queue.authenticated) {
    return (
      <form
        className="card mx-auto max-w-[26rem] p-8"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            await call("/api/admin/login", { password });
            setPassword("");
            load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <h1 className="display text-[2.25rem]">Reviewer sign-in.</h1>
        <label htmlFor="admin-password" className="mt-6 mb-2 block font-bold">
          Reviewer password
        </label>
        <input
          id="admin-password"
          type="password"
          className="field"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p role="alert" className="mt-3 font-medium text-clay">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-forest mt-5 w-full" disabled={!password}>
          Sign in
        </button>
      </form>
    );
  }

  const receipts = queue.receipts ?? [];
  const waiting = receipts.filter((r) => r.status === "submitted" || r.status === "under_review");
  const decided = receipts.filter((r) => r.status !== "submitted" && r.status !== "under_review");

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[clamp(2.4rem,5vw,3.75rem)]">Review queue.</h1>
          <p className="mt-3 text-[1.125rem] text-moss">
            {waiting.length} waiting · {decided.length} decided
          </p>
        </div>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={async () => {
            await call("/api/admin/logout", {});
            load();
          }}
        >
          Sign out
        </button>
      </div>

      <section aria-label="Campaign budgets" className="card-flat p-5">
        <p className="eyebrow mb-2">Campaign budgets</p>
        {(queue.campaigns ?? []).length === 0 ? (
          <p className="text-moss">
            No campaign is configured in the reward policy. Approved receipts will stay Approved and create no liability.
          </p>
        ) : (
          <ul className="divide-y divide-line text-[0.9375rem]">
            {(queue.campaigns ?? []).map((campaign) => (
              <li key={campaign.id} className="flex flex-wrap justify-between gap-3 py-2 font-mono">
                <span>
                  {campaign.id} {campaign.active ? "" : "(inactive)"}
                </span>
                <span>
                  budget {campaign.budget} · committed {campaign.committed} · available {campaign.available} {campaign.tokenSymbol}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Waiting for review">
        <h2 className="text-[1.5rem] font-extrabold">Waiting for review</h2>
        {waiting.length === 0 ? (
          <p className="card-flat mt-4 p-6 text-moss">The queue is empty. New submissions appear here.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {waiting.map((receipt) => (
              <ReviewCard key={receipt.id} receipt={receipt} onChanged={load} />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section aria-label="Decided">
          <h2 className="text-[1.5rem] font-extrabold">Decided</h2>
          <ul className="mt-4 space-y-4">
            {decided.map((receipt) => (
              <ReviewCard key={receipt.id} receipt={receipt} onChanged={load} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
