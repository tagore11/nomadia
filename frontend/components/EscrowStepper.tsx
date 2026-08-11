import { useTranslations } from "next-intl";

/**
 * A named, persistent progress tracker for the escrow lifecycle — research
 * on comparable P2P exchange products (Binance P2P, Paxful/NoOnes) points to
 * this as the single biggest trust lever: a status color or icon alone
 * doesn't tell a nervous first-time user *where in the process* their money
 * actually is.
 */
export function EscrowStepper({ currentStep }: { currentStep: 0 | 1 | 2 | 3 }) {
  const t = useTranslations("offerSteps");
  const steps = [t("accepted"), t("locked"), t("confirmed"), t("released")];

  return (
    <ol className="flex items-start gap-1.5">
      {steps.map((label, i) => {
        const reached = i <= currentStep;
        return (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition-colors ${reached ? "bg-accent" : "bg-border-2"}`}
              aria-hidden="true"
            />
            <span
              className={`text-center font-mono text-[10px] uppercase tracking-wide ${
                reached ? "text-accent-bright" : "text-text-dim"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
