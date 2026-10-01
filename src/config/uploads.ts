/** Upload limits and the receipt retention policy. */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_TYPES = {
  "image/jpeg": { ext: "jpg", label: "JPEG" },
  "image/png": { ext: "png", label: "PNG" },
  "application/pdf": { ext: "pdf", label: "PDF" },
} as const;

export type AcceptedMime = keyof typeof ACCEPTED_TYPES;

export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,application/pdf";

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const;

/**
 * Retention: the receipt file is deleted this many days after a final
 * decision (rejected or claimed). The reviewed fields stay as the reward
 * record. A user can delete a receipt and its file at any time before a
 * claim starts.
 */
export const FILE_RETENTION_DAYS_AFTER_DECISION = 90;
