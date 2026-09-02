import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import type { PublicOffer } from "@/lib/offer-types";
import { ReputationBadge } from "./ReputationBadge";
import { FairnessBadge } from "./FairnessBadge";
import { VouchBadge } from "./VouchBadge";
import { findVenue } from "@/lib/venues";

export function OfferCard({ offer }: { offer: PublicOffer }) {
  const t = useTranslations();
  const format = useFormatter();
  const isDemand = offer.direction === "fiat_to_crypto";

  return (
    <Link
      href={`/offers/${offer.id}`}
      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-2"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`font-mono text-[11px] uppercase tracking-wider ${
            isDemand ? "text-accent-bright" : "text-[#8fb8ff]"
          }`}
        >
          {t(`direction.${offer.direction}`)}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">
          {t(`offerStatus.${offer.status}`)}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-2 font-mono [font-variant-numeric:tabular-nums]">
        <span className="text-lg text-foreground">
          {format.number(offer.crypto_amount)} {offer.crypto_token}
        </span>
        <span className="text-text-dim">↔</span>
        <span className="text-lg text-foreground">
          {format.number(offer.fiat_amount)} {offer.fiat_currency}
        </span>
      </div>

      <div className="mt-1.5">
        <FairnessBadge
          cryptoAmount={offer.crypto_amount}
          cryptoToken={offer.crypto_token}
          fiatAmount={offer.fiat_amount}
          fiatCurrency={offer.fiat_currency}
          variant="compact"
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-text-muted">
        <span>{offer.city}</span>
        <span className="text-text-dim">·</span>
        <span>{format.dateTime(new Date(offer.created_at), { dateStyle: "medium", timeStyle: "short" })}</span>
        <span className="ml-auto">
          <ReputationBadge reputation={offer.depositorReputation} />
        </span>
      </div>
      {offer.depositorVouchedBy && (
        <div className="mt-1">
          <VouchBadge vouchedBy={offer.depositorVouchedBy} vouchCount={offer.depositorVouchCount} />
        </div>
      )}
      {offer.safe_zone && (
        <div className="mt-1.5 flex items-center gap-1.5 text-xs">
          <span className={findVenue(offer.safe_zone)?.kind === "partner" ? "text-accent-bright" : "text-text-dim"} aria-hidden="true">
            ◈
          </span>
          <span className="text-text-muted">{t("venues.meetsAt", { venue: offer.safe_zone })}</span>
        </div>
      )}
    </Link>
  );
}
