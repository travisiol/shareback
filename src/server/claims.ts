import "server-only";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, CLAIM_CONFIRMATIONS, CLAIM_VOUCHER_TTL_SECONDS, REWARD_TOKENS, REWARD_VAULT_ADDRESS } from "@/config/network";
import { LIVE_POLICY } from "@/config/reward-policy";
import type { ClaimAdapter } from "@/core/ledger";
import { CLAIM_EIP712, REWARD_VAULT_ABI } from "@/lib/reward-vault-abi";

/**
 * The real claim adapter. It exists only when a reward contract address and
 * a signer key are configured; otherwise live claims are disabled and the
 * interface says so. The signer key never leaves the server.
 *
 * Not exercised against a deployed contract yet — there is none.
 */
export function claimAdapter(): ClaimAdapter | null {
  const key = process.env.REWARD_SIGNER_PRIVATE_KEY;
  const vault = REWARD_VAULT_ADDRESS;
  if (!vault || !key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;

  const account = privateKeyToAccount(key as `0x${string}`);
  const client = createPublicClient({ transport: http(process.env.RPC_URL || CHAIN.rpcUrl) });

  const isClaimed = (claimId: `0x${string}`) =>
    client.readContract({ address: vault, abi: REWARD_VAULT_ABI, functionName: "claimed", args: [claimId] });

  return {
    voucherTtlSeconds: CLAIM_VOUCHER_TTL_SECONDS,
    tokenAddress: (symbol) => REWARD_TOKENS[symbol]?.address ?? null,
    sign: (voucher) =>
      account.signTypedData({
        domain: {
          name: CLAIM_EIP712.domainName,
          version: CLAIM_EIP712.domainVersion,
          chainId: CHAIN.id,
          verifyingContract: vault,
        },
        types: CLAIM_EIP712.types,
        primaryType: "Claim",
        message: {
          claimId: voucher.claimId,
          recipient: voucher.recipient,
          token: voucher.token,
          amount: BigInt(voucher.amount),
          expiry: BigInt(voucher.expiry),
        },
      }),
    isClaimed,
    txStatus: async (claimId, txHash) => {
      let receipt;
      try {
        receipt = await client.getTransactionReceipt({ hash: txHash });
      } catch {
        return "pending"; // not mined (or not found) yet
      }
      if (receipt.status !== "success") return "failed";
      if (receipt.to?.toLowerCase() !== vault.toLowerCase()) return "failed";
      const head = await client.getBlockNumber();
      if (head - receipt.blockNumber + BigInt(1) < BigInt(CLAIM_CONFIRMATIONS)) return "pending";
      return (await isClaimed(claimId)) ? "confirmed" : "failed";
    },
  };
}

export function claimsStatus(): { enabled: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!REWARD_VAULT_ADDRESS) missing.push("A deployed reward contract (NEXT_PUBLIC_REWARD_VAULT_ADDRESS)");
  if (!process.env.REWARD_SIGNER_PRIVATE_KEY) missing.push("The reward signer key (REWARD_SIGNER_PRIVATE_KEY)");
  if (!LIVE_POLICY.campaigns.some((c) => c.active)) missing.push("A funded campaign in the reward policy");
  return { enabled: missing.length === 0, missing };
}
