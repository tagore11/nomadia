"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { haptic } from "@/lib/telegram";
import { findVenue, venuesForCity } from "@/lib/venues";
import { VenueCard } from "./VenueCard";
import type { PublicOffer } from "@/lib/offer-types";

// Where the two parties meet. Participants of a matched trade can pick one of
// the curated venues for the offer's city; everyone else just sees the choice.
// The value stored in safe_zone is the venue name, so it stays readable even
// if a venue is later removed from the curated list.
export function MeetingPoint({ offer }: { offer: PublicOffer }) {
  const t = useTranslations("meetingPoint");
  const errorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<string>("");

  const isParticipant = offer.viewerRole !== null;
  const editable = isParticipant && (offer.status === "matched" || offer.status === "open");
  const venue = findVenue(offer.safe_zone);
  const options = venuesForCity(offer.city);
  const mapHref = `/map?city=${encodeURIComponent(offer.city)}&offer=${offer.id}${venue ? `&venue=${venue.id}` : ""}`;

  const save = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ offer: PublicOffer }>(`/api/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ safeZone: name }),
      }),
    onSuccess: () => {
      haptic().notify("success");
      setChoice("");
      queryClient.invalidateQueries({ queryKey: ["offer", String(offer.id)] });
    },
  });

  return (
    <section className="mt-5 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <Link href={mapHref} className="text-xs text-accent-bright underline decoration-dotted underline-offset-2">
          {t("openMap")} ↗
        </Link>
      </div>

      {venue ? (
        <div className="mt-3">
          <VenueCard venue={venue} compact />
        </div>
      ) : offer.safe_zone ? (
        <p className="mt-2 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-sm text-foreground">
          {offer.safe_zone}
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-muted">{isParticipant ? t("unsetParticipant") : t("unsetPublic")}</p>
      )}

      {editable && options.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            aria-label={t("pickLabel")}
            className="min-w-0 flex-1 rounded-lg border border-border-2 bg-surface-2 px-3 py-2 text-sm text-foreground"
          >
            <option value="">{venue ? t("changeTo") : t("pickLabel")}</option>
            {options.map((v) => (
              <option key={v.id} value={v.name} disabled={v.name === offer.safe_zone}>
                {v.kind === "partner" ? "◈ " : ""}
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!choice || save.isPending}
            onClick={() => save.mutate(choice)}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-deep transition-colors hover:bg-accent-bright disabled:opacity-40"
          >
            {t("save")}
          </button>
        </div>
      )}
      {save.error && <p className="mt-2 text-sm text-danger">{errorMessage(save.error)}</p>}
      <p className="mt-3 text-xs text-text-dim">{t("hint")}</p>
    </section>
  );
}
