"use client";

import { useTranslations } from "next-intl";
import { useIdentityStatus } from "@/lib/use-identity-status";
import { TelegramLoginWidget } from "./TelegramLoginWidget";

/**
 * Sign-in prompt for browser/PWA users who have no Telegram identity yet
 * (D-018). Renders nothing inside the Mini App or once signed in. Used to gate
 * write surfaces (post offer, claim, confirm) so the API's 401 never surprises
 * the user — they see why and how to fix it first.
 */
export function TelegramLoginGate() {
  const t = useTranslations("auth");
  const status = useIdentityStatus();

  if (status !== "anonymous") return null;

  return (
    <div className="rounded-xl border border-border-2 bg-surface p-5 text-center">
      <p className="text-base font-semibold text-foreground">{t("signInTitle")}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">{t("signInBody")}</p>
      <div className="mt-4">
        <TelegramLoginWidget />
      </div>
    </div>
  );
}
