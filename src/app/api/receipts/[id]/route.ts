import { ledger } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requireUser } from "@/server/session";
import { removeReceiptFile } from "@/server/storage";

export async function GET(_request: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    return Response.json({ receipt: ledger().getReceipt(id, user) });
  });
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    const { fileKey } = ledger().deleteReceipt(id, user);
    if (fileKey) await removeReceiptFile(fileKey);
    return Response.json({ ok: true });
  });
}
