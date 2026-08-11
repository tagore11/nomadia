"use client";

import { useTranslations, useFormatter } from "next-intl";
import { assessFairness } from "@/lib/rates";
import { useRates } from "@/lib/use-rates";

type Props = {
  cryptoAmount: number;
  cryptoToken: string;
  fiatAmount: number;
  fiatCurrency: string;
  variant?: "compact" | "full";
};

// verdict -> token color class (accent = fair, warn = off-market, danger = suspicious)
const TONE: Record<string, string> = {
  fair: "text-accent-bright",
  above: "text-warn",
  below: "text-warn",
  suspicious: "text-danger",
};

export function FairnessBadge({ cryptoAmount, cryptoToken, fiatAmount, fiatCurrency, variant = "compact" }: Props) {
  const t = useTranslations("fairness");
  const format = useFormatter();
  const rates = useRates();

  const f = assessFairness({ cryptoAmount, cryptoToken, fiatAmount, fiatCurrency, rates });
  if (!f) return null;

  const abs = Math.abs(f.deltaPct);
  const pct = format.number(Math.round(abs));
  const tone = TONE[f.verdict];
  const label =
    f.verdict === "fair"
      ? t("fair")
      : f.verdict === "suspicious"
        ? t("suspicious")
        : f.deltaPct > 0
          ? t("above", { pct })
          : t("below", { pct });

  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone}`}>
        <span aria-hidden="true">{f.verdict === "fair" ? "●" : f.verdict === "suspicious" ? "▲" : "○"}</span>
        {label}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-border-2 bg-surface p-4">
      <div className={`flex items-center gap-2 text-sm font-semibold ${tone}`}>
        <span aria-hidden="true">{f.verdict === "fair" ? "●" : f.verdict === "suspicious" ? "▲" : "○"}</span>
        {label}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm [font-variant-numeric:tabular-nums]">
        <dt className="text-text-muted">{t("marketLabel")}</dt>
        <dd className="text-right text-foreground">
          ≈ {format.number(f.referencePerCrypto, { maximumFractionDigits: 2 })} {fiatCurrency} / {cryptoToken}
        </dd>
        <dt className="text-text-muted">{t("thisOfferLabel")}</dt>
        <dd className="text-right text-foreground">
          {format.number(f.impliedPerCrypto, { maximumFractionDigits: 2 })} {fiatCurrency} / {cryptoToken}
        </dd>
      </dl>
      {f.verdict === "suspicious" && <p className="mt-2 text-xs text-danger">{t("suspiciousHint")}</p>}
      <p className="mt-2 text-[11px] text-text-dim">{t("advisory")}</p>
    </div>
  );
}
