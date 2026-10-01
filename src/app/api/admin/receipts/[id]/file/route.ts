import { ledger } from "@/server/db";
import { handle } from "@/server/http";
import { requireAdmin } from "@/server/session";
import { readReceiptFile } from "@/server/storage";

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/receipts/[id]/file">) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const { key, mime } = ledger().adminFileKey(id);
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
