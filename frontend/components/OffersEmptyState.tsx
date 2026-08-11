import Link from "next/link";
import { useTranslations } from "next-intl";

// Cold-start is the product for the first 1000 users: when no offers exist yet,
// this screen has to do the inviting instead of showing a dead grey line. It
// explains the loop in three steps and hands the visitor one clear action.
export function OffersEmptyState() {
  const t = useTranslations("offersList");
  const steps = [t("how1"), t("how2"), t("how3")];

  return (
    <div className="rounded-2xl border border-border bg-surface px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">{t("emptyTitle")}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">{t("emptyBody")}</p>

      <ol className="mx-auto mt-6 flex max-w-sm flex-col gap-3 text-left">
        {steps.map((label, i) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-tint font-mono text-xs text-accent-bright">
              {i + 1}
            </span>
            <span className="text-sm text-foreground">{label}</span>
          </li>
        ))}
      </ol>

      <Link
        href="/offers/new"
        className="mt-8 inline-flex items-center justify-center rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-deep transition-opacity hover:opacity-90"
      >
        {t("emptyCta")}
      </Link>
    </div>
  );
}
