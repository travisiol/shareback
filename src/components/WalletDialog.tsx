"use client";

import { useState } from "react";
import { CHAIN } from "@/config/network";
import {
  closeWalletDialog,
  connectWallet,
  disconnectWallet,
  openWalletDialog,
  shortAddress,
  useWallet,
  walletErrorMessage,
} from "@/lib/wallet";
import type { DiscoveredWallet } from "@/lib/wallet";
import { Modal } from "./Modal";
import { WalletIcon } from "./icons";

export function WalletDialog() {
  const wallet = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    closeWalletDialog();
  };

  const connect = async (candidate: DiscoveredWallet) => {
    setBusy(candidate.id);
    setError(null);
    try {
      await connectWallet(candidate);
      close();
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal open={wallet.dialogOpen} onClose={close} title={wallet.address ? "Your wallet" : "Connect a wallet"}>
      {wallet.address ? (
        <div className="space-y-5">
          <div className="card flex items-center gap-4 p-5">
            <span className="grid size-12 place-items-center rounded-full bg-lime">
              <WalletIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-lg font-medium">{shortAddress(wallet.address)}</p>
              <p className="text-sm text-moss">Connected with {wallet.walletName}</p>
            </div>
          </div>
          <p className="text-[0.9375rem] leading-relaxed text-moss">
            Rewards are claimed on {CHAIN.name}. Connecting only shares your address — it never moves funds.
          </p>
          <button
            type="button"
            className="btn btn-quiet w-full"
            onClick={() => {
              disconnectWallet();
              close();
            }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[0.9375rem] leading-relaxed text-moss">
            A wallet is where claimed rewards arrive, and how you sign in to submit a receipt.
          </p>
          {wallet.wallets.length > 0 ? (
            <ul className="space-y-2.5">
              {wallet.wallets.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => connect(candidate)}
                    className="card flex w-full items-center gap-4 p-4 text-left transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {candidate.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- wallet-provided data URI
                      <img src={candidate.icon} alt="" className="size-10 rounded-xl" />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-xl bg-cream-deep">
                        <WalletIcon className="size-5" />
                      </span>
                    )}
                    <span className="flex-1 text-lg font-bold">{candidate.name}</span>
                    {busy === candidate.id ? <span className="spinner" /> : <span className="text-sm text-moss">Detected</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card-flat p-5">
              <p className="font-bold">No wallet detected in this browser</p>
              <p className="mt-1 text-[0.9375rem] leading-relaxed text-moss">
                Install a browser wallet that supports {CHAIN.name}, then reopen this window.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-[14px] bg-clay-soft px-4 py-3 text-[0.9375rem] font-medium text-clay">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

export function WalletButton({ className = "btn btn-forest" }: { className?: string }) {
  const wallet = useWallet();
  return (
    <button type="button" className={className} onClick={openWalletDialog}>
      {wallet.address ? (
        <>
          <span className="size-2 rounded-full bg-lime" aria-hidden="true" />
          <span className="font-mono text-[0.9375rem] font-medium">{shortAddress(wallet.address)}</span>
        </>
      ) : (
        "Connect wallet"
      )}
    </button>
  );
}
