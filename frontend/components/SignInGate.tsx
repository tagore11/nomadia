"use client";

import { useTranslations } from "next-intl";
import { useIdentityStatus } from "@/lib/use-identity-status";
import { TelegramLoginWidget } from "./TelegramLoginWidget";
import { WalletSignIn } from "./WalletSignIn";

/**
 * Multi-provider sign-in for browser/PWA users (D-018 superseded). Any of three
 * paths establishes an identity:
 *   - Connect a wallet, or sign in with Google/Apple (embedded wallet) via the
 *     appkit-button, then sign the SIWE message (WalletSignIn). Light tier.
 *   - Telegram Login Widget. Phone-backed, higher tier.
 * Renders nothing inside the Mini App or once signed in.
 */
export function SignInGate() {
  const t = useTranslations("auth");
  const status = useIdentityStatus();

  if (status !== "anonymous") return null;

  return (
    <div className="rounded-xl border border-border-2 bg-surface p-5">
      <p className="text-center text-base font-semibold text-foreground">{t("signInTitle")}</p>
      <p className="mx-auto mt-1 max-w-sm text-center text-sm text-text-muted">{t("signInBody")}</p>

      <div className="mt-4 flex flex-col items-center gap-3">
        {/* Connect wallet / Google / Apple — createAppKit wires this up. */}
        <appkit-button size="md" balance="hide" />
        <WalletSignIn />

        <div className="flex w-full items-center gap-3 py-1 text-xs text-text-dim">
          <span className="h-px flex-1 bg-border" />
          {t("or")}
          <span className="h-px flex-1 bg-border" />
        </div>

        <TelegramLoginWidget />
      </div>

      <p className="mt-4 text-center text-xs text-text-dim">{t("tierNote")}</p>
    </div>
  );
}
