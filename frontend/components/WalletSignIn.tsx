"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useTranslations } from "next-intl";
import { buildSiweMessage, setStoredWalletAuth } from "@/lib/wallet-auth";

/**
 * Second half of the wallet sign-in: once a wallet is connected (via the
 * appkit-button — a cold wallet, or the embedded wallet a Google/Apple login
 * creates), the user signs a SIWE message to prove control and establish their
 * identity. Renders nothing until a wallet is connected.
 */
export function WalletSignIn({ onDone }: { onDone?: () => void }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected || !address) return null;

  async function signIn() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const message = buildSiweMessage(address);
      const signature = await signMessageAsync({ message });
      setStoredWalletAuth({ address, message, signature });
      onDone?.();
    } catch {
      setError(t("signFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-deep transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? t("signing") : t("signInWithWallet")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
