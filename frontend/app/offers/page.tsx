"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { OfferCard } from "@/components/OfferCard";
import { OffersEmptyState } from "@/components/OffersEmptyState";
import { SignInGate } from "@/components/SignInGate";
import type { PublicOffer } from "@/lib/offer-types";

type Direction = "all" | "crypto_to_fiat" | "fiat_to_crypto";

export default function OffersPage() {
  const t = useTranslations("offersList");
  const tDirection = useTranslations("direction");
  const errorMessage = useApiErrorMessage();
  const [direction, setDirection] = useState<Direction>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["offers", direction],
    queryFn: () =>
      apiFetch<{ offers: PublicOffer[] }>(
        `/api/offers${direction !== "all" ? `?direction=${direction}` : ""}`
      ),
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <SignInGate />
      </div>

      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-muted">
        {t("subtitle")}{" "}
        <Link href="/map" className="text-accent-bright underline decoration-dotted underline-offset-2">
          {t("mapLink")}
        </Link>
      </p>

      {/* Threshold strip: the home route redirects straight here, so this one line
          is the first thing a newcomer reads — what Nomadia is and why it's safe. */}
      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="mt-0.5 flex-none text-accent-bright" aria-hidden="true">◈</span>
        <p className="text-sm text-text-muted">{t("valueStrip")}</p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["all", "crypto_to_fiat", "fiat_to_crypto"] as Direction[]).map((value) => (
          <button
            key={value}
            onClick={() => setDirection(value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              direction === value
                ? "border-accent text-accent-bright"
                : "border-border-2 text-text-muted hover:text-foreground"
            }`}
          >
            {value === "all" ? t("filterAll") : tDirection(value)}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading && <p className="text-text-muted">{t("loading")}</p>}
        {error && <p className="text-danger">{errorMessage(error)}</p>}
        {data?.offers.length === 0 && <OffersEmptyState />}
        {data?.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  );
}
