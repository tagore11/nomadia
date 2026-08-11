"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { useIdentityStatus } from "@/lib/use-identity-status";
import { OfferCard } from "@/components/OfferCard";
import { SignInGate } from "@/components/SignInGate";
import type { PublicOffer } from "@/lib/offer-types";

export default function MyOffersPage() {
  const t = useTranslations("myOffers");
  const errorMessage = useApiErrorMessage();
  const status = useIdentityStatus();

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-offers"],
    queryFn: () => apiFetch<{ offers: PublicOffer[] }>("/api/offers/mine"),
    enabled: status !== "anonymous",
    refetchInterval: 15_000,
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>

      {status === "anonymous" ? (
        <div className="mt-6">
          <SignInGate />
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {isLoading && <p className="text-text-muted">{t("loading")}</p>}
          {error && <p className="text-danger">{errorMessage(error)}</p>}
          {data?.offers.length === 0 && <p className="text-text-muted">{t("empty")}</p>}
          {data?.offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
