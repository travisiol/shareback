import { ledger } from "@/server/db";
import { handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { readReceiptFile } from "@/server/storage";

/** The receipt file, for its owner only. Never cached by shared caches. */
export async function GET(_request: Request, ctx: RouteContext<"/api/receipts/[id]/file">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    const { key, mime } = ledger().fileKey(id, user);
    const bytes = await readReceiptFile(key);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": mime,
        "cache-control": "private, no-store",
        "content-disposition": "inline",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  });
}
