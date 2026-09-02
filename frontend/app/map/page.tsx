"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { haptic } from "@/lib/telegram";
import { CITIES, CITY_META, isCity, venuesForCity, type City, type Venue } from "@/lib/venues";
import { VenueCard } from "@/components/VenueCard";
import type { PublicOffer } from "@/lib/offer-types";

// Leaflet touches `window` at import time, so the map only ever renders on the client.
const VenueMap = dynamic(() => import("@/components/VenueMap").then((m) => m.VenueMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-surface" />,
});

export default function MapPage() {
  return (
    <Suspense fallback={null}>
      <MapPageInner />
    </Suspense>
  );
}

function MapPageInner() {
  const t = useTranslations("map");
  const tVenues = useTranslations("venues");
  const errorMessage = useApiErrorMessage();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();

  const offerId = params.get("offer");
  const cityParam = params.get("city");
  const [city, setCity] = useState<City>(cityParam && isCity(cityParam) ? cityParam : CITIES[0]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("venue"));

  const venues = useMemo(() => venuesForCity(city), [city]);
  const partners = venues.filter((v) => v.kind === "partner");
  const publics = venues.filter((v) => v.kind !== "partner");
  const meta = CITY_META[city];

  // Open offers per city power the tab counters: the map is also a "where is
  // the action" view, not only a venue directory.
  const { data: offersData } = useQuery({
    queryKey: ["offers", "all"],
    queryFn: () => apiFetch<{ offers: PublicOffer[] }>("/api/offers"),
    staleTime: 30_000,
  });
  const countByCity = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of offersData?.offers ?? []) m.set(o.city, (m.get(o.city) ?? 0) + 1);
    return m;
  }, [offersData]);

  // When arriving from an offer, the viewer may pick a meeting point for it.
  const { data: offerData } = useQuery({
    queryKey: ["offer", offerId],
    queryFn: () => apiFetch<{ offer: PublicOffer }>(`/api/offers/${offerId}`),
    enabled: !!offerId,
  });
  const offer = offerData?.offer;
  const canPick = !!offer && offer.viewerRole !== null && (offer.status === "matched" || offer.status === "open");

  const pick = useMutation({
    mutationFn: (venue: Venue) =>
      apiFetch<{ offer: PublicOffer }>(`/api/offers/${offerId}`, {
        method: "PATCH",
        body: JSON.stringify({ safeZone: venue.name }),
      }),
    onSuccess: () => {
      haptic().notify("success");
      queryClient.invalidateQueries({ queryKey: ["offer", offerId] });
      router.push(`/offers/${offerId}`);
    },
  });

  const select = (v: Venue) => {
    setSelectedId(v.id);
    document.getElementById(`venue-${v.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const pickAction = (v: Venue) =>
    canPick ? (
      <button
        type="button"
        disabled={pick.isPending}
        onClick={(e) => {
          e.stopPropagation();
          pick.mutate(v);
        }}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
          offer?.safe_zone === v.name
            ? "border border-accent text-accent-bright"
            : "bg-accent text-accent-deep hover:bg-accent-bright"
        }`}
      >
        {offer?.safe_zone === v.name ? t("currentPoint") : t("useAsPoint")}
      </button>
    ) : undefined;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{t("title")}</h1>
      <p className="mt-1 max-w-xl text-sm text-text-muted">{t("subtitle")}</p>

      {offer && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent bg-accent-tint px-4 py-3 text-sm">
          <span className="text-foreground">
            {canPick ? t("pickingFor", { id: offer.id }) : t("viewingFor", { id: offer.id })}
          </span>
          <Link href={`/offers/${offer.id}`} className="text-xs text-accent-bright underline decoration-dotted">
            {t("backToOffer")}
          </Link>
        </div>
      )}
      {pick.error && <p className="mt-2 text-sm text-danger">{errorMessage(pick.error)}</p>}

      {/* City switcher with live open-offer counts */}
      <div className="mt-5 flex flex-wrap gap-2">
        {CITIES.map((c) => {
          const n = countByCity.get(c) ?? 0;
          const active = c === city;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCity(c);
                setSelectedId(null);
              }}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active ? "border-accent bg-accent-tint text-accent-bright" : "border-border-2 text-text-muted hover:text-foreground"
              }`}
            >
              {c}
              <span className={`font-mono text-[11px] ${active ? "text-accent" : "text-text-dim"}`}>
                {t("openCount", { n })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div className="relative mt-4 h-[52vh] min-h-[320px] overflow-hidden rounded-2xl border border-border-2">
        <VenueMap
          venues={venues}
          center={meta.center}
          zoom={meta.zoom}
          selectedId={selectedId}
          onSelect={select}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5 rounded-lg border border-border-2 bg-background/85 px-3 py-2 text-[11px] backdrop-blur">
          <span className="flex items-center gap-2 text-foreground">
            <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
            {t("legendPartner")}
          </span>
          <span className="flex items-center gap-2 text-text-muted">
            <span className="h-3 w-3 rounded-full border border-accent bg-surface" />
            {t("legendPublic")}
          </span>
        </div>
      </div>

      {/* Partner venues */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">{t("partnerTitle")}</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">{meta.timeZone}</span>
        </div>
        <p className="mt-1 text-sm text-text-muted">{t("partnerBody")}</p>
        <div className="mt-4 grid gap-3">
          {partners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-2 p-4 text-sm text-text-muted">
              {t("noPartnerYet", { city })}{" "}
              <a href="https://t.me/nomadp2pbot" target="_blank" rel="noopener noreferrer" className="text-accent-bright underline decoration-dotted">
                {t("becomePartner")}
              </a>
            </div>
          ) : (
            partners.map((v) => (
              <VenueCard key={v.id} venue={v} selected={v.id === selectedId} onSelect={select} action={pickAction(v)} />
            ))
          )}
        </div>
      </section>

      {/* Public safe spots */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">{t("publicTitle")}</h2>
        <p className="mt-1 text-sm text-text-muted">{t("publicBody")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {publics.map((v) => (
            <VenueCard key={v.id} venue={v} selected={v.id === selectedId} onSelect={select} action={pickAction(v)} compact />
          ))}
        </div>
      </section>

      {/* Meetup rules */}
      <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="text-accent-bright" aria-hidden="true">◈</span>
          <h2 className="text-base font-semibold text-foreground">{t("rulesTitle")}</h2>
        </div>
        <ul className="mt-3 flex flex-col gap-2.5">
          {(["daylight", "inside", "onchain", "walk"] as const).map((k) => (
            <li key={k} className="flex items-start gap-2.5 text-sm text-text-muted">
              <span className="mt-1 flex-none text-accent" aria-hidden="true">✓</span>
              <span>{t(`rule_${k}`)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-text-dim">{tVenues("dataNote")}</p>
      </section>
    </div>
  );
}
