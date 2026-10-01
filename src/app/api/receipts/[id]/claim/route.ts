import { LedgerError } from "@/core/ledger";
import { claimAdapter, claimsStatus } from "@/server/claims";
import { ledger } from "@/server/db";
import { assertSameOrigin, handle, readJson } from "@/server/http";
import { requireUser } from "@/server/session";

function adapterOrRefuse() {
  const adapter = claimAdapter();
  if (!adapter || !claimsStatus().enabled) throw new LedgerError(503, "Live claims are not enabled on this deployment.");
  return adapter;
}

/** Start (or resume) a claim: returns the signed authorization to send to the reward contract. */
export async function POST(request: Request, ctx: RouteContext<"/api/receipts/[id]/claim">) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    return Response.json(await ledger().beginClaim(id, user, adapterOrRefuse()));
  });
}

/** Report the transaction hash, or just ask the server to re-check the chain. */
export async function PUT(request: Request, ctx: RouteContext<"/api/receipts/[id]/claim">) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    const { txHash } = await readJson<{ txHash?: string }>(request);
    return Response.json({ receipt: await ledger().syncClaim(id, user, adapterOrRefuse(), txHash) });
  });
}
