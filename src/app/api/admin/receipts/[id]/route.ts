import { companyByKey } from "@/config/eligibility";
import { LedgerError } from "@/core/ledger";
import { ledger } from "@/server/db";
import { assertSameOrigin, handle, readJson } from "@/server/http";
import { requireAdmin } from "@/server/session";

interface Body {
  action?: "start" | "approve" | "reject" | "reserve";
  companyKey?: string;
  reason?: string;
}

export async function POST(request: Request, ctx: RouteContext<"/api/admin/receipts/[id]">) {
  return handle(async () => {
    assertSameOrigin(request);
    const actor = await requireAdmin(); // enforced here, not by hiding the page
    const { id } = await ctx.params;
    const body = await readJson<Body>(request);

    switch (body.action) {
      case "start":
        return Response.json({ receipt: ledger().startReview(id, actor) });
      case "approve": {
        const company = companyByKey(body.companyKey);
        if (!company) throw new LedgerError(400, "Choose the eligible company this purchase was made from.");
        return Response.json({ receipt: ledger().approve(id, actor, company.key) });
      }
      case "reject":
        return Response.json({ receipt: ledger().reject(id, actor, String(body.reason ?? "")) });
      case "reserve":
        return Response.json({ receipt: ledger().reserve(id) });
      default:
        throw new LedgerError(400, "Unknown action.");
    }
  });
}
