"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "@/lib/use-locale";
import { directionsUrl, isOpenNow, osmUrl, type OpeningSlot, type Venue } from "@/lib/venues";

/** "Mon-Fri 09:00-17:00 · Sat 10:00-14:00" in the viewer's language. */
export function formatHours(slots: OpeningSlot[], locale: string): string {
  const dayName = (iso: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
      // 2024-01-01 is a Monday; offset by (iso-1) days.
      .format(new Date(Date.UTC(2024, 0, iso)));
  return slots
    .map((s) => {
      const days = [...s.days].sort((a, b) => a - b);
      const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
      const label =
        days.length === 7
          ? dayName(1) + "-" + dayName(7)
          : days.length > 2 && contiguous
            ? `${dayName(days[0])}-${dayName(days[days.length - 1])}`
            : days.map(dayName).join(", ");
      const time = s.open === "00:00" && s.close === "24:00" ? "24h" : `${s.open}-${s.close}`;
      return `${label} ${time}`;
    })
    .join(" · ");
}

type Props = {
  venue: Venue;
  selected?: boolean;
  onSelect?: (venue: Venue) => void;
  /** Extra action rendered at the bottom (e.g. "Use as meeting point"). */
  action?: React.ReactNode;
  compact?: boolean;
};

export function VenueCard({ venue, selected = false, onSelect, action, compact = false }: Props) {
  const t = useTranslations("venues");
  const [locale] = useLocale();
  const open = isOpenNow(venue);
  const isPartner = venue.kind === "partner";

  return (
    <div
      id={`venue-${venue.id}`}
      onClick={onSelect ? () => onSelect(venue) : undefined}
      className={`rounded-xl border p-4 transition-colors ${
        isPartner
          ? selected
            ? "border-accent-bright bg-accent-tint shadow-[0_0_0_1px_var(--color-accent)]"
            : "border-accent bg-accent-tint"
          : selected
            ? "border-border-2 bg-surface-2"
            : "border-border bg-surface hover:border-border-2"
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isPartner && (
              <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent-deep">
                {t("partnerBadge")}
              </span>
            )}
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">{t(`kind.${venue.kind}`)}</span>
          </div>
          <div className={`mt-1 truncate font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
            {venue.name}
          </div>
          {venue.address && !compact && <div className="mt-0.5 text-xs text-text-muted">{venue.address}</div>}
        </div>
        {open !== undefined && (
          <span
            className={`flex flex-none items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider ${
              open ? "text-accent-bright" : "text-text-dim"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${open ? "bg-accent shadow-[0_0_6px_var(--color-accent)]" : "bg-text-dim"}`} />
            {open ? t("openNow") : t("closedNow")}
          </span>
        )}
      </div>

      {venue.hours && (
        <div className="mt-2 font-mono text-[11px] text-text-muted [font-variant-numeric:tabular-nums]">
          {formatHours(venue.hours, locale)}
        </div>
      )}

      {venue.noteKey && !compact && <p className="mt-2 text-sm text-text-muted">{t(`notes.${venue.noteKey}`)}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <a
          href={directionsUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-accent-bright underline decoration-dotted underline-offset-2"
        >
          {t("directions")} ↗
        </a>
        <a
          href={osmUrl(venue)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          OpenStreetMap
        </a>
        {venue.website && (
          <a
            href={venue.website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-text-muted underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            {venue.website.replace(/^https?:\/\//, "")}
          </a>
        )}
        {venue.phone && (
          <a href={`tel:${venue.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} className="font-mono text-text-muted hover:text-foreground">
            {venue.phone}
          </a>
        )}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
