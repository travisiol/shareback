import { progressStep, STATUS_LABEL } from "@/core/status";
import type { ReceiptStatus } from "@/core/status";
import { CheckIcon } from "../icons";

const TONE: Record<ReceiptStatus, string> = {
  draft: "badge-neutral",
  submitted: "badge-pending",
  under_review: "badge-pending",
  approved: "badge-good",
  rejected: "badge-bad",
  claimable: "badge-solid",
  claiming: "badge-pending",
  claimed: "badge-good",
};

export function StatusBadge({ status }: { status: ReceiptStatus }) {
  return <span className={`badge ${TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

const STOPS = ["Submitted", "Reviewed", "Reserved", "Claimed"];

/** Four stops. "Reviewed" and "Reserved" are separate on purpose: approved is not claimable. */
export function ProgressTrack({ status }: { status: ReceiptStatus }) {
  const reached = progressStep(status);
  const rejected = status === "rejected";
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label={`Progress: ${STATUS_LABEL[status]}`}>
      {STOPS.map((label, index) => {
        const done = reached > index;
        const failed = rejected && index === 1;
        return (
          <li key={label} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${failed ? "bg-clay" : done ? "bg-forest" : "bg-line"}`}
              aria-hidden="true"
            />
            <div className="mt-2 flex items-center gap-1.5 text-[0.8125rem] font-bold">
              {done && !failed && <CheckIcon className="size-3.5 shrink-0" strokeWidth={3} />}
              <span className={`truncate ${failed ? "text-clay" : done ? "" : "text-sage"}`}>
                {failed ? "Rejected" : label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
