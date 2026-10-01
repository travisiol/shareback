"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { matchMerchant } from "@/config/eligibility";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, SUPPORTED_CURRENCIES } from "@/config/uploads";
import { REVIEW_PROMISE, REVIEW_WINDOW_HOURS, REWARD_PROMISE } from "@/config/service";
import { fileProblem, parseTotal, sniffMime, validateFields } from "@/core/fields";
import type { FieldErrors } from "@/core/fields";
import { formatBytes, now, todayIso } from "@/lib/format";
import { ApiError, liveStore, useLive } from "@/lib/live";
import { BrandMark } from "../BrandMark";
import { ArrowLeft, ArrowRight, CameraIcon, CheckIcon, FileIcon, InfoIcon, UploadIcon } from "../icons";
import { LiveGate } from "./LiveGate";
import { ReceiptDetail } from "./ReceiptDetail";

interface Draft {
  file: File;
  mime: string;
  url: string;
}

interface Form {
  merchant: string;
  purchaseDate: string;
  total: string;
  currency: string;
}

const EMPTY_FORM: Form = { merchant: "", purchaseDate: "", total: "", currency: "USD" };

type Step = "upload" | "review" | "status";
const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "status", label: "Status" },
];

function Stepper({ step }: { step: Step }) {
  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <ol className="flex items-center gap-2 text-[0.9375rem] font-bold sm:gap-3" aria-label="Steps">
      {STEPS.map((s, index) => (
        <li key={s.key} className="flex items-center gap-2 sm:gap-3" aria-current={index === current ? "step" : undefined}>
          <span
            className={`grid size-8 place-items-center rounded-full text-sm ${
              index < current ? "bg-forest text-lime" : index === current ? "bg-lime text-forest" : "bg-cream-deep text-moss"
            }`}
          >
            {index < current ? <CheckIcon className="size-4" strokeWidth={3} /> : index + 1}
          </span>
          <span className={index === current ? "" : "text-moss"}>{s.label}</span>
          {index < STEPS.length - 1 && <span className="h-px w-5 bg-line sm:w-10" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function Preview({ draft, className = "" }: { draft: Draft; className?: string }) {
  if (draft.mime.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- local object URL
    return <img src={draft.url} alt="Receipt preview" className={`w-full rounded-[18px] bg-paper object-contain shadow-soft ${className}`} />;
  }
  return (
    <div className={`grid place-items-center gap-3 rounded-[18px] bg-paper p-8 text-center shadow-soft ${className}`}>
      <FileIcon className="size-12" strokeWidth={1.6} />
      <p className="font-bold break-all">{draft.file.name}</p>
      <a href={draft.url} target="_blank" rel="noreferrer" className="text-sm font-bold underline underline-offset-4">
        Open the PDF
      </a>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-cream-deep px-2 py-0.5 text-xs font-bold text-moss">{children}</span>;
}

export default function UploadFlow() {
  const live = useLive();
  const [step, setStep] = useState<Step>("upload");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string; existing: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const ids = useId();

  const maxAge = live.config?.maxReceiptAgeDays ?? 30;

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const mime = sniffMime(head);
    const problem = fileProblem(file.size, mime);
    if (problem || !mime) {
      setFileError(`${file.name}: ${problem}`);
      return;
    }
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft({ file, mime, url: URL.createObjectURL(file) });
  };

  const removeFile = () => {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setStep("upload");
  };

  const submit = async () => {
    if (!draft) return;
    setSubmitError(null);
    const total = parseTotal(form.total);
    const checked = validateFields(
      { merchant: form.merchant, purchaseDate: form.purchaseDate, totalMinor: total ?? undefined, currency: form.currency },
      now(),
      maxAge,
    );
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await liveStore.submit(checked.fields, draft.file);
      setSubmitted({ id: result.receipt.id, existing: !result.created });
      setStep("status");
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      setSubmitError(e instanceof ApiError ? e.message : "The receipt could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setDraft(null);
    setForm(EMPTY_FORM);
    setSubmitted(null);
    setErrors({});
    setStep("upload");
  };

  // A session is needed before anything is uploaded.
  if (!live.ready) return <p className="text-moss">Loading…</p>;
  if (!live.session) return <LiveGate title="Sign in to scan a receipt" />;

  const match = matchMerchant(form.merchant);
  const receipt = submitted ? live.receipts.find((r) => r.id === submitted.id) : undefined;

  return (
    <div className="mx-auto max-w-[62rem]">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display text-[clamp(2.4rem,5vw,3.75rem)]">
            {step === "upload" ? "Scan your receipt." : step === "review" ? "Check the details." : "Receipt received."}
          </h1>
          <p className="mt-3 max-w-[36rem] text-[1.125rem] leading-relaxed text-moss">
            {step === "upload"
              ? "Add a photo or PDF of a receipt from an eligible company."
              : step === "review"
                ? "A reviewer compares these against the receipt, so make them match what is printed."
                : `We've got it. We'll review it within ${REVIEW_WINDOW_HOURS} hours and send your reward right after approval.`}
          </p>
        </div>
        <Stepper step={step} />
      </div>

      {/* ───────────────────────────── 1 · upload */}
      {step === "upload" && (
        <div className="mt-8 space-y-5">
          {!draft ? (
            <div
              className="dropzone grid place-items-center px-6 py-[clamp(2.5rem,7vw,4.5rem)] text-center"
              data-over={over}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(false);
                void takeFile(event.dataTransfer.files[0]);
              }}
            >
              <span className="grid size-16 place-items-center rounded-full bg-lime">
                <UploadIcon className="size-8" />
              </span>
              <p className="mt-5 text-[1.5rem] font-extrabold tracking-[-0.02em]">Drop your receipt here</p>
              <p className="mt-1 text-moss">or pick one from your device</p>
              <div className="mt-6 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
                <button type="button" className="btn btn-forest min-h-[3.5rem] px-7 text-[1.0625rem]" onClick={() => fileInput.current?.click()}>
                  Choose a file
                </button>
                <button type="button" className="btn btn-quiet min-h-[3.5rem] px-7 text-[1.0625rem]" onClick={() => cameraInput.current?.click()}>
                  <CameraIcon className="size-5" /> Take a photo
                </button>
              </div>
              <p className="mt-5 text-sm text-moss">JPEG, PNG or PDF · up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB</p>
            </div>
          ) : (
            <div className="card grid gap-6 p-5 sm:grid-cols-[14rem_1fr] sm:p-6">
              <Preview draft={draft} className="max-h-[18rem]" />
              <div className="flex flex-col">
                <p className="eyebrow">Ready to review</p>
                <p className="mt-2 text-[1.25rem] font-extrabold break-all">{draft.file.name}</p>
                <p className="text-moss">
                  {draft.mime === "application/pdf" ? "PDF" : draft.mime === "image/png" ? "PNG" : "JPEG"} · {formatBytes(draft.file.size)}
                </p>
                <div className="mt-auto flex flex-wrap gap-2.5 pt-6">
                  <button type="button" className="btn btn-lime" onClick={() => setStep("review")}>
                    Continue <ArrowRight className="size-5" />
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={() => fileInput.current?.click()}>
                    Replace
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={removeFile}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            tabIndex={-1}
            aria-label="Receipt file"
            onChange={(event) => {
              void takeFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-label="Take a photo of the receipt"
            onChange={(event) => {
              void takeFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {fileError && (
            <p role="alert" className="rounded-[14px] bg-clay-soft px-4 py-3 font-medium text-clay">
              {fileError}
            </p>
          )}

          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-moss">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {REVIEW_PROMISE} {REWARD_PROMISE} Your receipt stays private: only you and the reviewer can open it.
          </p>
        </div>
      )}

      {/* ───────────────────────────── 2 · review */}
      {step === "review" && draft && (
        <form
          className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Preview draft={draft} className="max-h-[30rem]" />
            <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-md text-[0.9375rem] font-bold" onClick={() => setStep("upload")}>
              <ArrowLeft className="size-4" /> Change the file
            </button>
          </div>

          <div className="space-y-5">
            <div className="rounded-[16px] bg-cream-deep px-4 py-3.5 text-[0.9375rem] leading-relaxed">
              <strong>Nothing was read from your file.</strong> Automatic extraction is not connected, so please type the
              details exactly as printed.
            </div>

            <div className="card space-y-5 p-5 sm:p-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor={`${ids}-merchant`} className="font-bold">
                    Merchant
                  </label>
                  <Tag>Entered by you</Tag>
                </div>
                <input
                  id={`${ids}-merchant`}
                  className="field"
                  placeholder="The seller at the top of the receipt"
                  autoComplete="off"
                  value={form.merchant}
                  aria-invalid={Boolean(errors.merchant)}
                  aria-describedby={`${ids}-merchant-help`}
                  onChange={(event) => setForm({ ...form, merchant: event.target.value })}
                />
                <p id={`${ids}-merchant-help`} className={`mt-1.5 text-sm ${errors.merchant ? "font-medium text-clay" : "text-moss"}`}>
                  {errors.merchant ?? "The store that sold it — not the brand of the product."}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor={`${ids}-date`} className="font-bold">
                      Purchase date
                    </label>
                    <Tag>Entered by you</Tag>
                  </div>
                  <input
                    id={`${ids}-date`}
                    type="date"
                    className="field"
                    max={todayIso()}
                    value={form.purchaseDate}
                    aria-invalid={Boolean(errors.purchaseDate)}
                    onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })}
                  />
                  <p className={`mt-1.5 text-sm ${errors.purchaseDate ? "font-medium text-clay" : "text-moss"}`}>
                    {errors.purchaseDate ?? `Within the last ${maxAge} days.`}
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor={`${ids}-total`} className="font-bold">
                      Total
                    </label>
                    <Tag>Entered by you</Tag>
                  </div>
                  <div className="flex gap-2">
                    <input
                      id={`${ids}-total`}
                      className="field"
                      inputMode="decimal"
                      placeholder="0.00"
                      autoComplete="off"
                      value={form.total}
                      aria-invalid={Boolean(errors.totalMinor)}
                      onChange={(event) => setForm({ ...form, total: event.target.value })}
                    />
                    <select
                      className="field w-auto"
                      aria-label="Currency"
                      value={form.currency}
                      onChange={(event) => setForm({ ...form, currency: event.target.value })}
                    >
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <option key={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <p className={`mt-1.5 text-sm ${errors.totalMinor || errors.currency ? "font-medium text-clay" : "text-moss"}`}>
                    {errors.totalMinor ?? errors.currency ?? "The final amount paid, including tax."}
                  </p>
                </div>
              </div>
            </div>

            {/* candidate company — computed from the merchant rule, confirmed later by a reviewer */}
            <div className="card p-5 sm:p-6" aria-live="polite">
              <p className="eyebrow">Candidate eligible company</p>
              {match.kind === "eligible" ? (
                <div className="mt-3 flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-cream">
                    <BrandMark company={match.company.key} className="size-6" />
                  </span>
                  <div>
                    <p className="text-[1.25rem] font-extrabold">
                      {match.company.name}
                      {match.company.tokenSymbol && <span className="ml-2 font-mono text-base font-medium text-moss">{match.company.tokenSymbol}</span>}
                    </p>
                    <p className="mt-1 text-[0.9375rem] leading-relaxed text-moss">
                      Matched by the merchant name. This is a candidate, not a decision — a reviewer confirms it against the
                      receipt.
                    </p>
                  </div>
                </div>
              ) : match.kind === "third-party" ? (
                <p className="mt-3 text-[0.9375rem] leading-relaxed">
                  <strong>{match.merchant} is a third-party seller.</strong> Eligibility follows the merchant, so products of
                  other brands bought there do not qualify for those brands&apos; rewards. You can still submit, but expect a
                  rejection.
                </p>
              ) : (
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-moss">
                  {form.merchant.trim().length < 2
                    ? "Enter the merchant to see whether it matches an eligible company."
                    : "No eligible company matches this merchant name. You can still submit; a reviewer decides."}
                </p>
              )}
            </div>

            {submitError && (
              <p role="alert" className="rounded-[14px] bg-clay-soft px-4 py-3 font-medium text-clay">
                {submitError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-lime min-h-[3.5rem] px-8 text-[1.0625rem]" disabled={busy}>
                {busy && <span className="spinner" />}
                Submit for review
              </button>
              <button type="button" className="btn btn-quiet min-h-[3.5rem]" onClick={() => setStep("upload")}>
                Back
              </button>
              <p className="basis-full text-sm text-moss sm:basis-auto">
                Reviewed within {REVIEW_WINDOW_HOURS} hours of submission.
              </p>
            </div>
          </div>
        </form>
      )}

      {/* ───────────────────────────── 3 · status */}
      {step === "status" && submitted && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="card p-5 sm:p-7">
            {submitted.existing && (
              <p className="mb-5 rounded-[14px] bg-honey px-4 py-3 text-[0.9375rem] font-medium text-[#5c4a07]">
                You already submitted this exact file. This is the existing receipt — no duplicate was created.
              </p>
            )}
            {receipt ? (
              <ReceiptDetail receipt={receipt} onDeleted={restart} />
            ) : (
              <p className="text-moss">This receipt is no longer in your list.</p>
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
            <div className="card-flat p-5">
              <p className="text-[1.125rem] font-extrabold">What happens next</p>
              <ol className="mt-3 space-y-2.5 text-[0.9375rem] leading-relaxed text-moss">
                <li>1. We check the merchant, date and total against your receipt.</li>
                <li>2. {REVIEW_PROMISE}</li>
                <li>3. {REWARD_PROMISE}</li>
              </ol>
            </div>
            <Link href="/app/dashboard" className="btn btn-forest w-full">
              Go to dashboard
            </Link>
            <button type="button" className="btn btn-quiet w-full" onClick={restart}>
              Upload another receipt
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
