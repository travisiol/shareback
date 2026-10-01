import { normalizeMerchant } from "../config/eligibility.ts";
import { MAX_UPLOAD_BYTES, SUPPORTED_CURRENCIES } from "../config/uploads.ts";
import type { AcceptedMime } from "../config/uploads.ts";
import type { ReceiptFields } from "./types.ts";

export type FieldErrors = Partial<Record<keyof ReceiptFields, string>>;

const DAY_MS = 86_400_000;

/** "1,297.00" → 129700. Returns null when the text is not a money amount. */
export function parseTotal(text: string): number | null {
  const cleaned = text.replace(/[\s,$€£]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/**
 * The same checks run in the browser (for feedback) and on the server (for
 * real). `now` and `maxAgeDays` make the age rule explicit and testable.
 */
export function validateFields(
  input: Partial<ReceiptFields>,
  now: number,
  maxAgeDays: number,
): { ok: true; fields: ReceiptFields } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const merchant = (input.merchant ?? "").trim();
  if (merchant.length < 2) errors.merchant = "Enter the merchant shown at the top of the receipt.";
  else if (merchant.length > 80) errors.merchant = "Merchant name is too long.";

  const purchaseDate = (input.purchaseDate ?? "").trim();
  const time = /^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) ? Date.parse(`${purchaseDate}T00:00:00Z`) : NaN;
  if (Number.isNaN(time)) errors.purchaseDate = "Enter the purchase date.";
  else if (time > now + DAY_MS) errors.purchaseDate = "The purchase date is in the future.";
  else if (now - time > maxAgeDays * DAY_MS)
    errors.purchaseDate = `Receipts must be submitted within ${maxAgeDays} days of purchase.`;

  const totalMinor = input.totalMinor;
  if (typeof totalMinor !== "number" || !Number.isInteger(totalMinor) || totalMinor <= 0)
    errors.totalMinor = "Enter the receipt total.";
  else if (totalMinor > 100_000_000) errors.totalMinor = "That total is outside the supported range.";

  const currency = (input.currency ?? "").toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency))
    errors.currency = "Choose a supported currency.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, fields: { merchant, purchaseDate, totalMinor: totalMinor as number, currency } };
}

/** Normalized fields used to flag likely duplicates. Not proof of anything. */
export function fingerprint(fields: ReceiptFields): string {
  return [normalizeMerchant(fields.merchant), fields.purchaseDate, fields.totalMinor, fields.currency].join("|");
}

/** Detect the real file type from its first bytes, ignoring the claimed type. */
export function sniffMime(bytes: Uint8Array): AcceptedMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d)
    return "application/pdf";
  return null;
}

export function fileProblem(size: number, mime: string | null): string | null {
  if (size === 0) return "That file is empty.";
  if (size > MAX_UPLOAD_BYTES) return `That file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
  if (!mime) return "Only JPEG, PNG and PDF receipts are supported.";
  return null;
}
