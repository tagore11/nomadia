import { useTranslations } from "next-intl";
import type { Reputation } from "@/lib/offer-types";

/**
 * Compact trust signal for a trader: average stars + number of rated trades, or
 * a "new trader" label when there's no history yet. The rating data was already
 * collected; this is the missing surface the review flagged.
 */
export function ReputationBadge({ reputation }: { reputation: Reputation }) {
  const t = useTranslations("reputation");

  if (reputation.ratingCount === 0) {
    return <span className="text-xs text-text-dim">{t("newTrader")}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
      <span className="text-accent-bright">★</span>
      <span className="font-mono [font-variant-numeric:tabular-nums] text-foreground">
        {reputation.avgStars?.toFixed(1)}
      </span>
      <span className="text-text-dim">({t("trades", { count: reputation.ratingCount })})</span>
    </span>
  );
}
