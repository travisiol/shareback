import { LIVE_POLICY } from "@/config/reward-policy";
import { claimsStatus } from "@/server/claims";
import { runtime } from "@/server/db";
import { handle } from "@/server/http";
import { adminConfigured, sessionsAvailable } from "@/server/session";

export interface LiveStatus {
  signIn: boolean;
  storagePersistent: boolean;
  review: boolean;
  extraction: boolean;
  activeCampaigns: number;
  claims: { enabled: boolean; missing: string[] };
  maxReceiptAgeDays: number;
}

/** What the live side of this deployment can actually do right now. */
export async function GET() {
  return handle(async () => {
    const status: LiveStatus = {
      signIn: sessionsAvailable(),
      storagePersistent: runtime().persistent,
      review: adminConfigured(),
      extraction: false, // no OCR provider is integrated; fields are entered by the user
      activeCampaigns: LIVE_POLICY.campaigns.filter((c) => c.active).length,
      claims: claimsStatus(),
      maxReceiptAgeDays: LIVE_POLICY.maxReceiptAgeDays,
    };
    return Response.json(status);
  });
}
