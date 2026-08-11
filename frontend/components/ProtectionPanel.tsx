import { useTranslations } from "next-intl";

// The cash-handover moment is the emotional peak of the product. Instead of a
// data sheet ("chainOfferId #3"), this speaks human: here's how you're protected,
// here's the one rule that keeps you safe, and here's the proof if you want it.
export function ProtectionPanel({
  chainOfferId,
  escrowAddress,
  explorerBase,
  isTestnet,
}: {
  chainOfferId: number | null;
  escrowAddress?: `0x${string}`;
  explorerBase: string;
  isTestnet: boolean;
}) {
  const t = useTranslations("protection");
  const points = [t("lockedPoint"), t("confirmPoint"), t("disputePoint")];

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="text-accent-bright" aria-hidden="true">◈</span>
        <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2.5 text-sm text-text-muted">
            <span className="mt-1 flex-none text-accent" aria-hidden="true">✓</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg border border-border-2 bg-accent-tint px-3 py-2.5 text-sm font-medium text-foreground">
        {t("caution")}
      </p>

      {chainOfferId != null && escrowAddress && (
        <div className="mt-3 flex items-center justify-between text-xs text-text-dim">
          <span>{isTestnet ? t("verifiedTestnet") : t("verified")}</span>
          <a
            href={`${explorerBase}/address/${escrowAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-bright underline decoration-dotted"
          >
            {t("proofLink")}
          </a>
        </div>
      )}
    </section>
  );
}
