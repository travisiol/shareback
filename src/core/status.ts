/** The receipt state model, shared by the API and the interface. */

export const STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "claimable",
  "claiming",
  "claimed",
] as const;

export type ReceiptStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  claimable: "Claimable",
  claiming: "Claiming",
  claimed: "Claimed",
};

/** Honest one-liners: no processing estimates, no promises. */
export const STATUS_EXPLAINER: Record<ReceiptStatus, string> = {
  draft: "Not submitted yet. Only you can see it.",
  submitted: "We have received your receipt. It will be reviewed within 2 hours.",
  under_review: "A reviewer is checking the purchase details against the receipt.",
  approved: "Your purchase is verified. Your reward is being prepared and will be sent right after.",
  rejected: "This receipt was not accepted. The reason is shown below.",
  claimable: "Your reward is funded and reserved. You can claim it to your wallet.",
  claiming: "The claim transaction is waiting for confirmation on the network.",
  claimed: "The claim transaction is confirmed. The reward is in your wallet.",
};

const TRANSITIONS: Record<ReceiptStatus, ReceiptStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "approved", "rejected"],
  under_review: ["approved", "rejected"],
  approved: ["claimable", "rejected"],
  rejected: [],
  claimable: ["claiming", "approved"],
  claiming: ["claimed", "claimable"],
  claimed: [],
};

export function canTransition(from: ReceiptStatus, to: ReceiptStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinal(status: ReceiptStatus): boolean {
  return status === "rejected" || status === "claimed";
}

/** Position on the four-stop progress track shown in the interface. */
export function progressStep(status: ReceiptStatus): number {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
    case "under_review":
      return 1;
    case "approved":
    case "rejected":
      return 2;
    case "claimable":
    case "claiming":
      return 3;
    case "claimed":
      return 4;
  }
}
