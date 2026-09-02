import { useTranslations } from "next-intl";

/**
 * Web-of-trust signal next to a trader: who vouched for them (redeemed invite)
 * and how many members they have vouched for. Renders nothing for a trader
 * with no chain, so the card stays quiet instead of shouting "unvouched".
 */
export function VouchBadge({
  vouchedBy,
  vouchCount,
  variant = "compact",
}: {
  vouchedBy: string | null;
  vouchCount: number;
  variant?: "compact" | "full";
}) {
  const t = useTranslations("vouch");
  if (!vouchedBy && vouchCount === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
      {vouchedBy && (
        <span className="inline-flex items-center gap-1">
          <span className="text-accent-bright" aria-hidden>
            ✓
          </span>
          <span>{t("vouchedBy", { handle: vouchedBy })}</span>
        </span>
      )}
      {variant === "full" && vouchCount > 0 && (
        <span className="text-text-dim">{t("vouchedFor", { count: vouchCount })}</span>
      )}
    </span>
  );
}
