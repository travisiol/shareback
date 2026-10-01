/**
 * Merchant eligibility — the one explicit rule set.
 *
 * Eligibility follows the MERCHANT on the receipt (the seller of record),
 * never the brands of the products on it. An Apple product bought from a
 * marketplace or a big-box retailer is a receipt from that retailer, and it
 * does not qualify for an Apple reward.
 *
 * Listing a company here does not make it rewardable: a reward also needs a
 * funded campaign in reward-policy.ts. Brand names identify where a purchase
 * was made. They are not partnerships, sponsorships or endorsements.
 */

export interface EligibleCompany {
  key: string;
  /** Company name as shown in the interface. */
  name: string;
  /** Ticker of the company's tokenized stock, if one is configured in network.ts. */
  tokenSymbol: string | null;
  /** Lower-case merchant names that count as buying directly from the company. */
  merchantNames: string[];
  /** Short line used on company cards. */
  blurb: string;
}

export const COMPANIES: EligibleCompany[] = [
  {
    key: "apple",
    name: "Apple",
    tokenSymbol: "AAPL",
    merchantNames: ["apple", "apple store", "apple.com", "apple inc", "apple online store"],
    blurb: "Apple Store and apple.com receipts",
  },
  {
    key: "nvidia",
    name: "NVIDIA",
    tokenSymbol: "NVDA",
    merchantNames: ["nvidia", "nvidia store", "nvidia.com", "nvidia marketplace"],
    blurb: "Purchases made directly from NVIDIA",
  },
  {
    key: "tesla",
    name: "Tesla",
    tokenSymbol: "TSLA",
    merchantNames: ["tesla", "tesla shop", "tesla.com", "tesla inc", "tesla store"],
    blurb: "Tesla Shop and service receipts",
  },
  {
    key: "meta",
    name: "Meta",
    tokenSymbol: "META",
    merchantNames: ["meta", "meta store", "meta.com", "meta quest store", "meta platforms"],
    blurb: "Meta Store hardware receipts",
  },
  {
    key: "dell",
    name: "Dell",
    tokenSymbol: "DELL",
    merchantNames: ["dell", "dell.com", "dell technologies", "dell inc", "dell outlet"],
    blurb: "Purchases made directly from Dell",
  },
  {
    key: "netflix",
    name: "Netflix",
    tokenSymbol: "NFLX",
    merchantNames: ["netflix", "netflix.com", "netflix inc"],
    blurb: "Netflix subscription invoices",
  },
];

/**
 * Third-party sellers we recognise by name so the interface can explain why
 * a receipt from them does not qualify for another company's reward.
 */
export const THIRD_PARTY_MERCHANTS = [
  "amazon",
  "amazon.com",
  "best buy",
  "walmart",
  "target",
  "costco",
  "ebay",
  "b&h",
  "newegg",
];

export function normalizeMerchant(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&.+ ]+/g, " ")
    .replace(/\s+#?\d+$/g, "") // trailing store numbers
    .replace(/\s+/g, " ")
    .trim();
}

export type MerchantMatch =
  | { kind: "eligible"; company: EligibleCompany }
  | { kind: "third-party"; merchant: string }
  | { kind: "unknown" };

/** Exact match on the normalized merchant name — never a substring of a product line. */
export function matchMerchant(rawMerchant: string): MerchantMatch {
  const merchant = normalizeMerchant(rawMerchant);
  if (!merchant) return { kind: "unknown" };
  for (const company of COMPANIES) {
    if (company.merchantNames.includes(merchant)) return { kind: "eligible", company };
  }
  if (THIRD_PARTY_MERCHANTS.includes(merchant)) return { kind: "third-party", merchant: rawMerchant.trim() };
  return { kind: "unknown" };
}

export function companyByKey(key: string | null | undefined): EligibleCompany | null {
  if (!key) return null;
  return COMPANIES.find((c) => c.key === key) ?? null;
}
