"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Venue } from "@/lib/venues";

// Keyless vector basemap (OpenFreeMap, OSM data, dark style). No API key
// means nothing to leak in the client bundle and nothing that expires on a
// Vercel redeploy.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const KIND_GLYPH: Record<Venue["kind"], string> = {
  partner: "◈",
  bank: "₿",
  post: "✉",
  police: "★",
  municipal: "▣",
  hotel: "⌂",
  mall: "▤",
};

function buildMarkerElement(venue: Venue): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `nm-marker-wrap ${venue.kind === "partner" ? "is-partner" : ""}`;
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", venue.name);
  el.innerHTML =
    `<span class="nm-marker-label">${venue.name}</span>` +
    `<span class="nm-marker nm-marker-${venue.kind === "partner" ? "partner" : "public"}">` +
    `<span class="nm-marker-glyph">${KIND_GLYPH[venue.kind]}</span></span>`;
  return el;
}

type Props = {
  venues: Venue[];
  center: [number, number]; // [lat, lng] to match the venue data
  zoom: number;
  selectedId: string | null;
  onSelect: (venue: Venue) => void;
  className?: string;
};

export function VenueMap({ venues, center, zoom, selectedId, onSelect, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const t = useTranslations("map");
  const fallbackText = t("webglUnsupported");
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [center[1], center[0]],
        zoom,
        attributionControl: { compact: true },
        // Plain scroll keeps scrolling the page; two fingers / ctrl+wheel zoom.
        cooperativeGestures: true,
      });
    } catch {
      // Old webviews without WebGL2 throw at construction. The venue list
      // below still works; the map area explains itself instead of staying
      // blank. The container is MapLibre's DOM, not React's, so writing to
      // it directly is fine.
      const el = containerRef.current;
      el.className = `${className ?? ""} flex items-center justify-center bg-surface p-6 text-center text-sm text-text-muted`;
      el.textContent = fallbackText;
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      // Handle for local debugging / screenshot scripts (never shipped).
      (window as unknown as { __nmMap?: maplibregl.Map }).__nmMap = map;
    }
    const markers = markersRef.current;
    return () => {
      for (const m of markers.values()) m.remove();
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Center/zoom changes are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers when the venue set (city) changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current.values()) m.remove();
    markersRef.current.clear();
    for (const v of venues) {
      const el = buildMarkerElement(v);
      const pick = () => onSelectRef.current(v);
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([v.lng, v.lat]).addTo(map);
      markersRef.current.set(v.id, marker);
    }
    // Frame every venue of the city with room for labels and the controls.
    if (venues.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const v of venues) bounds.extend([v.lng, v.lat]);
      map.fitBounds(bounds, { padding: { top: 90, bottom: 70, left: 50, right: 80 }, maxZoom: zoom, duration: 0 });
    } else {
      map.jumpTo({ center: [center[1], center[0]], zoom });
    }
  }, [venues, center, zoom]);

  // Highlight + fly to the selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markersRef.current) {
      marker.getElement().classList.toggle("is-selected", id === selectedId);
    }
    const sel = venues.find((v) => v.id === selectedId);
    if (sel) map.flyTo({ center: [sel.lng, sel.lat], zoom: Math.max(map.getZoom(), 16.5), duration: 700 });
  }, [selectedId, venues]);

  return <div ref={containerRef} className={className} role="region" aria-label="map" />;
}
