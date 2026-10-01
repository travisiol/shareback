const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const DATE_TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const formatDate = (time: number) => DATE.format(time);
export const formatDateTime = (time: number) => DATE_TIME.format(time);

/** "2026-09-14" → "Sep 14, 2026", without timezone drift. */
export function formatIsoDate(iso: string): string {
  const time = Date.parse(`${iso}T12:00:00Z`);
  return Number.isNaN(time) ? iso : DATE.format(time);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Kept outside components: render must stay pure. */
export const now = () => Date.now();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const ACTION_LABEL: Record<string, string> = {
  submitted: "Submitted for review",
  review_started: "Review started",
  approved: "Purchase verified",
  rejected: "Rejected",
  reward_reserved: "Reward funded and reserved",
  claim_started: "Claim started",
  claim_confirmed: "Claim confirmed",
  claim_reset: "Claim returned to claimable",
  file_removed: "Receipt file removed",
};
