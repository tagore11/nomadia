"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useIdentityStatus } from "@/lib/use-identity-status";

type Me = {
  id: string;
  tier: string;
  username: string | null;
  inviteCode: string;
  vouchedBy: string | null;
  vouchCount: number;
};

/**
 * The trader's own web-of-trust card: their invite link to share, who vouched
 * for them, and how many people they have vouched for. Lives on "My offers".
 */
export function InvitePanel() {
  const t = useTranslations("vouch");
  const status = useIdentityStatus();
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/api/me"),
    enabled: status !== "anonymous",
    staleTime: 60_000,
  });

  if (!data) return null;

  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/offers?invite=${data.inviteCode}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the code is visible to copy by hand */
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-foreground">{t("panelTitle")}</h2>
      <p className="mt-1 text-sm text-text-muted">{t("panelBody")}</p>

      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
          {link}
        </code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-border-2 px-3 py-2 text-sm text-foreground transition-colors hover:border-accent"
        >
          {copied ? t("copied") : t("copy")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        <span>
          {data.vouchedBy ? t("vouchedBy", { handle: data.vouchedBy }) : t("noVoucher")}
        </span>
        <span>{t("vouchedFor", { count: data.vouchCount })}</span>
      </div>
    </section>
  );
}
