"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useChainId, useReadContract } from "wagmi";
import { useTranslations, useFormatter } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { useMyTelegramId } from "@/lib/use-my-telegram-id";
import { ESCROW_ABI, ESCROW_ADDRESS } from "@/lib/contracts";
import { computeEscrowStep, type OnChainOfferView } from "@/lib/escrow-steps";
import { cryptoLockerRole } from "@/lib/offer-roles";
import { OfferActions } from "@/components/OfferActions";
import { FairnessBadge } from "@/components/FairnessBadge";
import { ProtectionPanel } from "@/components/ProtectionPanel";
import { EscrowStepper } from "@/components/EscrowStepper";
import { RatingWidget } from "@/components/RatingWidget";
import { ReputationBadge } from "@/components/ReputationBadge";
import { VouchBadge } from "@/components/VouchBadge";
import { MeetingPoint } from "@/components/MeetingPoint";
import type { PublicOffer } from "@/lib/offer-types";

const BASE_MAINNET_ID = 8453;

export default function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const myTelegramId = useMyTelegramId();
  const t = useTranslations("offerDetail");
  const tDirection = useTranslations("direction");
  const tStatus = useTranslations("offerStatus");
  const format = useFormatter();
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const chainId = useChainId();

  const { data, isLoading, error } = useQuery({
    queryKey: ["offer", id],
    queryFn: () => apiFetch<{ offer: PublicOffer }>(`/api/offers/${id}`),
    refetchInterval: 10_000,
  });

  const offer = data?.offer;
  const escrowAddress = ESCROW_ADDRESS[chainId];

  const {
    data: onChainOfferRaw,
    refetch: refetchOnChainOffer,
    isFetched: onChainDataFetched,
  } = useReadContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "getOffer",
    args: offer?.chain_offer_id ? [BigInt(offer.chain_offer_id)] : undefined,
    query: { enabled: Boolean(escrowAddress && offer?.chain_offer_id) },
  });
  const onChainOffer = onChainOfferRaw as unknown as OnChainOfferView | undefined;

  async function refreshOffer() {
    await queryClient.invalidateQueries({ queryKey: ["offer", id] });
    await refetchOnChainOffer();
  }

  if (isLoading) return <div className="mx-auto max-w-lg px-5 py-8 text-text-muted">{t("loading")}</div>;
  if (error) return <div className="mx-auto max-w-lg px-5 py-8 text-danger">{errorMessage(error)}</div>;
  if (!offer) return null;

  const currentStep = computeEscrowStep(offer, offer.chain_offer_id ? onChainOffer : undefined);

  // Perspective is the viewer's, not the offer poster's. A stranger browsing is a
  // potential taker (the counterparty), so default to that view — this fixes the
  // "You send" label reading backwards for everyone but the poster.
  const effectiveRole = offer.viewerRole ?? "counterparty";
  const iSendCrypto = effectiveRole === cryptoLockerRole(offer.direction);
  const sendAmount = iSendCrypto
    ? `${format.number(offer.crypto_amount)} ${offer.crypto_token}`
    : `${format.number(offer.fiat_amount)} ${offer.fiat_currency}`;
  const receiveAmount = iSendCrypto
    ? `${format.number(offer.fiat_amount)} ${offer.fiat_currency}`
    : `${format.number(offer.crypto_amount)} ${offer.crypto_token}`;

  const isTestnet = chainId !== BASE_MAINNET_ID;
  const explorerBase = isTestnet ? "https://sepolia.basescan.org" : "https://basescan.org";

  // The other party's contact, shown only once matched (fields are participant-only).
  const otherUsername =
    offer.viewerRole === "depositor"
      ? offer.counterparty_username
      : offer.viewerRole === "counterparty"
        ? offer.depositor_username
        : null;
  const otherReputation =
    offer.viewerRole === "depositor"
      ? offer.counterpartyReputation
      : offer.viewerRole === "counterparty"
        ? offer.depositorReputation
        : null;
  const otherContact =
    offer.viewerRole === "depositor"
      ? offer.counterparty_contact
      : offer.viewerRole === "counterparty"
        ? offer.depositor_contact
        : null;

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-accent-bright">
          {tDirection(offer.direction)}
        </span>
        <span className="font-mono text-xs uppercase tracking-wider text-text-dim">
          {tStatus(offer.status)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1 font-mono text-sm [font-variant-numeric:tabular-nums]">
        <div className="flex items-baseline justify-between">
          <span className="text-text-dim">{t("youSend")}</span>
          <span className="text-xl text-foreground">{sendAmount}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-text-dim">{t("youReceive")}</span>
          <span className="text-xl text-foreground">{receiveAmount}</span>
        </div>
      </div>

      <div className="mt-4">
        <FairnessBadge
          cryptoAmount={offer.crypto_amount}
          cryptoToken={offer.crypto_token}
          fiatAmount={offer.fiat_amount}
          fiatCurrency={offer.fiat_currency}
          variant="full"
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-text-muted">{t("posterLabel")}</span>
        <ReputationBadge reputation={offer.depositorReputation} />
      </div>
      {(offer.depositorVouchedBy || offer.depositorVouchCount > 0) && (
        <div className="mt-1 flex justify-end">
          <VouchBadge vouchedBy={offer.depositorVouchedBy} vouchCount={offer.depositorVouchCount} variant="full" />
        </div>
      )}

      {currentStep !== null && (
        <div className="mt-6">
          <EscrowStepper currentStep={currentStep} />
        </div>
      )}

      <ProtectionPanel
        chainOfferId={offer.chain_offer_id}
        escrowAddress={escrowAddress}
        explorerBase={explorerBase}
        isTestnet={isTestnet}
      />

      <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-text-muted">{t("region")}</dt>
        <dd className="text-foreground">{offer.city}</dd>
        <dt className="text-text-muted">{t("opened")}</dt>
        <dd className="text-foreground">
          {format.dateTime(new Date(offer.created_at), { dateStyle: "medium", timeStyle: "short" })}
        </dd>
        <dt className="text-text-muted">{t("expires")}</dt>
        <dd className="text-foreground">
          {format.dateTime(new Date(offer.expires_at), { dateStyle: "medium", timeStyle: "short" })}
        </dd>
        {offer.matchRate && (
          <>
            <dt className="text-text-muted">{t("rateAtMatch")}</dt>
            <dd className="text-foreground">
              <span className="font-mono [font-variant-numeric:tabular-nums]">
                1 {offer.crypto_token} ≈ {format.number(offer.matchRate.referencePerCrypto, { maximumFractionDigits: 2 })}{" "}
                {offer.matchRate.fiatCurrency}
              </span>
              <span className="ml-2 text-xs text-text-dim">
                {format.dateTime(new Date(offer.matchRate.at), { dateStyle: "medium", timeStyle: "short" })}
              </span>
              <p className="mt-0.5 text-xs text-text-dim">
                {t("rateAtMatchHint", { delta: format.number(offer.matchRate.deltaPct, { maximumFractionDigits: 1, signDisplay: "always" }) })}
              </p>
            </dd>
          </>
        )}
      </dl>

      {/* Match contact: once matched, participants see the other party's handle so
          the in-person meetup can actually be arranged (review's #2 funnel break). */}
      {offer.status !== "open" && offer.viewerRole && (
        <div className="mt-6 rounded-xl border border-border-2 bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{t("matchLabel")}</span>
            {otherReputation && <ReputationBadge reputation={otherReputation} />}
          </div>
          {otherUsername ? (
            <>
              <p className="mt-1 text-sm text-text-muted">{t("contactPrompt")}</p>
              <a
                href={`https://t.me/${otherUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-deep"
              >
                {t("contactCta")} @{otherUsername}
              </a>
            </>
          ) : otherContact ? (
            <>
              <p className="mt-1 text-sm text-text-muted">{t("contactPrompt")}</p>
              <p className="mt-2 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-sm text-foreground">
                {t("contactVia")} <span className="font-medium">{otherContact}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-muted">{t("noUsername")}</p>
          )}
        </div>
      )}

      <MeetingPoint offer={offer} />

      {/* Render for anonymous visitors too: with an empty identity myRole is
          "none", so an open offer shows the claim button, and the claim tap
          opens the connect modal in place (see OfferActions.handleClaim).
          Gating this on a signed-in identity hid the whole match funnel. */}
      <OfferActions
        offer={offer}
        myTelegramId={myTelegramId ?? ""}
        onChainOffer={onChainOffer}
        onChainDataReady={onChainDataFetched}
        refetchOnChainOffer={refetchOnChainOffer}
        refreshOffer={refreshOffer}
      />

      {offer.status === "released" && (
        <div className="mt-6 border-t border-border pt-5">
          <RatingWidget offerId={offer.id} />
        </div>
      )}
    </div>
  );
}
