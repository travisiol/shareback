import { createHash } from "node:crypto";
import { LIVE_POLICY } from "@/config/reward-policy";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES } from "@/config/uploads";
import { fileProblem, sniffMime, validateFields } from "@/core/fields";
import { LedgerError } from "@/core/ledger";
import { ledger } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { removeReceiptFile, saveReceiptFile } from "@/server/storage";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return Response.json({ receipts: ledger().listReceipts(user) });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();

    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new LedgerError(413, "That file is too large.");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new LedgerError(400, "Invalid upload.");
    }

    const file = form.get("file");
    if (!(file instanceof File)) throw new LedgerError(400, "Attach the receipt file.");
    if (file.size > MAX_UPLOAD_BYTES) throw new LedgerError(413, "That file is too large.");

    // Everything below trusts the bytes, not the name or the claimed type.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffMime(bytes);
    const problem = fileProblem(bytes.length, mime);
    if (problem || !mime) throw new LedgerError(415, problem ?? "Unsupported file.");

    const checked = validateFields(
      {
        merchant: String(form.get("merchant") ?? ""),
        purchaseDate: String(form.get("purchaseDate") ?? ""),
        totalMinor: Number(form.get("totalMinor")),
        currency: String(form.get("currency") ?? ""),
      },
      Date.now(),
      LIVE_POLICY.maxReceiptAgeDays,
    );
    if (!checked.ok) return Response.json({ error: "Check the highlighted fields.", fields: checked.errors }, { status: 422 });

    const ext = ACCEPTED_TYPES[mime].ext;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const name = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || `receipt.${ext}`;

    const { receipt, created } = ledger().createReceipt(user, checked.fields, { name, mime, size: bytes.length, sha256, ext });
    if (created) {
      try {
        await saveReceiptFile(`${receipt.id}.${ext}`, bytes);
      } catch {
        ledger().discard(receipt.id);
        await removeReceiptFile(`${receipt.id}.${ext}`).catch(() => {});
        throw new LedgerError(500, "The receipt could not be stored. Nothing was submitted.");
      }
    }
    return Response.json({ receipt, created }, { status: created ? 201 : 200 });
  });
}
