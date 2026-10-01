/**
 * The interface SHAREBACK expects from its reward contract. No such contract
 * is deployed; this is the integration boundary.
 *
 * Required behaviour:
 * - `claim` verifies an EIP-712 signature from the configured reward signer
 *   over (claimId, recipient, token, amount, expiry), requires
 *   `block.timestamp <= expiry`, requires `msg.sender == recipient`, pays
 *   `amount` of `token` to `recipient`, and marks `claimId` as used — so a
 *   claim id can be paid at most once, whatever the server re-signs.
 * - `claimed(claimId)` exposes that mark.
 * - Only a receipt-independent claim id and the payout reach the chain: no
 *   merchant, total, date or file hash.
 */
export const REWARD_VAULT_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimed",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "claimId", type: "bytes32", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const CLAIM_EIP712 = {
  domainName: "SharebackRewards",
  domainVersion: "1",
  types: {
    Claim: [
      { name: "claimId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint256" },
    ],
  },
} as const;
