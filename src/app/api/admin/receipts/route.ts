import { LIVE_POLICY } from "@/config/reward-policy";
import { formatUnits, parseUnits } from "@/core/units";
import { ledger } from "@/server/db";
import { handle } from "@/server/http";
import { adminConfigured, isAdmin, requireAdmin } from "@/server/session";
import { removeReceiptFile } from "@/server/storage";

export async function GET() {
  return handle(async () => {
    if (!adminConfigured()) return Response.json({ configured: false, authenticated: false });
    if (!(await isAdmin())) return Response.json({ configured: true, authenticated: false });
    await requireAdmin();

    // Retention runs whenever a reviewer opens the queue.
    for (const expired of ledger().expiredFiles()) {
      await removeReceiptFile(expired.key);
      ledger().markFileRemoved(expired.id);
    }

    const campaigns = LIVE_POLICY.campaigns.map((c) => {
      const committed = ledger().committedUnits(c.id);
      const budget = parseUnits(c.budget, c.tokenDecimals);
      return {
        id: c.id,
        companyKey: c.companyKey,
        tokenSymbol: c.tokenSymbol,
        active: c.active,
        budget: c.budget,
        committed: formatUnits(committed, c.tokenDecimals),
        available: formatUnits(budget - committed, c.tokenDecimals),
      };
    });
    return Response.json({ configured: true, authenticated: true, receipts: ledger().adminList(), campaigns });
  });
}
