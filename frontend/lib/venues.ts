// Curated safe exchange venues. Every entry is a real place taken from
// OpenStreetMap (coordinates checked against the OSM export; osmId is kept
// where the node id is known) so the map never shows an invented location. Two tiers:
//
//   partner  — a venue that has agreed to host Nomadia meetups: staff know
//              the flow, there is wifi and a table, and the trade can be
//              finished on the spot.
//   public   — banks, post offices, police, malls, hotel lobbies: cameras,
//              guards, daylight, other people around. Not affiliated with
//              Nomadia, just objectively safer than a street corner.
//
// Cities here must match the `city` values offers are posted with.

export const CITIES = ["Kaş", "Dubai Marina"] as const;
export type City = (typeof CITIES)[number];

export type VenueKind = "partner" | "bank" | "post" | "police" | "municipal" | "hotel" | "mall";

/** ISO weekday numbers, 1 = Monday … 7 = Sunday. */
export type OpeningSlot = { days: number[]; open: string; close: string };

export type Venue = {
  id: string;
  city: City;
  name: string;
  kind: VenueKind;
  lat: number;
  lng: number;
  osmId?: number;
  address?: string;
  phone?: string;
  website?: string;
  hours?: OpeningSlot[];
  /** Short i18n key under `venues.notes.*` describing why this spot is safe. */
  noteKey?: string;
};

export type CityMeta = {
  center: [number, number];
  zoom: number;
  timeZone: string;
  country: string;
};

export const CITY_META: Record<City, CityMeta> = {
  "Kaş": { center: [36.2005, 29.6395], zoom: 16, timeZone: "Europe/Istanbul", country: "TR" },
  "Dubai Marina": { center: [25.077, 55.134], zoom: 14, timeZone: "Asia/Dubai", country: "AE" },
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

export const VENUES: Venue[] = [
  // ── Kaş ──────────────────────────────────────────────────────────────
  {
    id: "kas-web3hub",
    city: "Kaş",
    name: "Web3 Hub Kaş",
    kind: "partner",
    lat: 36.2013263,
    lng: 29.6391491,
    osmId: 14101041963,
    address: "Bilginler Sokak 17/A, Andifli, Kaş 07580",
    phone: "+90 530 156 40 19",
    website: "https://web3metahub.io",
    hours: [
      { days: [1, 2, 4], open: "09:00", close: "20:00" },
      { days: [3, 5], open: "09:00", close: "22:00" },
      { days: [6], open: "00:00", close: "24:00" },
    ],
    noteKey: "partnerCowork",
  },
  {
    id: "kas-garanti",
    city: "Kaş",
    name: "Garanti BBVA",
    kind: "bank",
    lat: 36.20112,
    lng: 29.63895,
    hours: [{ days: WEEKDAYS, open: "09:00", close: "17:00" }],
    noteKey: "bank",
  },
  {
    id: "kas-isbank",
    city: "Kaş",
    name: "Türkiye İş Bankası",
    kind: "bank",
    lat: 36.20104,
    lng: 29.63866,
    hours: [{ days: WEEKDAYS, open: "09:00", close: "17:00" }],
    noteKey: "bank",
  },
  {
    id: "kas-ziraat",
    city: "Kaş",
    name: "Ziraat Bankası",
    kind: "bank",
    lat: 36.20081,
    lng: 29.63871,
    hours: [
      { days: WEEKDAYS, open: "09:00", close: "12:30" },
      { days: WEEKDAYS, open: "13:30", close: "17:00" },
    ],
    noteKey: "bank",
  },
  {
    id: "kas-yapikredi",
    city: "Kaş",
    name: "Yapı Kredi",
    kind: "bank",
    lat: 36.19954,
    lng: 29.63959,
    hours: [{ days: WEEKDAYS, open: "09:00", close: "17:00" }],
    noteKey: "bank",
  },
  {
    id: "kas-ptt",
    city: "Kaş",
    name: "PTT Kaş",
    kind: "post",
    lat: 36.20064,
    lng: 29.64135,
    hours: [{ days: WEEKDAYS, open: "08:30", close: "17:30" }],
    noteKey: "post",
  },
  {
    id: "kas-hukumet",
    city: "Kaş",
    name: "Kaş Hükümet Konağı",
    kind: "municipal",
    lat: 36.19846,
    lng: 29.64319,
    hours: [{ days: WEEKDAYS, open: "08:30", close: "17:30" }],
    noteKey: "municipal",
  },
  {
    id: "kas-jandarma",
    city: "Kaş",
    name: "Kaş Jandarma",
    kind: "police",
    lat: 36.19798,
    lng: 29.64325,
    hours: [{ days: EVERY_DAY, open: "00:00", close: "24:00" }],
    noteKey: "police",
  },
  {
    id: "kas-artemis",
    city: "Kaş",
    name: "Kaş Artemis Hotel",
    kind: "hotel",
    lat: 36.20329,
    lng: 29.63957,
    hours: [{ days: EVERY_DAY, open: "00:00", close: "24:00" }],
    noteKey: "hotel",
  },
  {
    id: "kas-luff",
    city: "Kaş",
    name: "Luff Suites",
    kind: "hotel",
    lat: 36.20054,
    lng: 29.64092,
    hours: [{ days: EVERY_DAY, open: "00:00", close: "24:00" }],
    noteKey: "hotel",
  },

  // ── Dubai Marina ─────────────────────────────────────────────────────
  {
    id: "dxb-marina-mall",
    city: "Dubai Marina",
    name: "Dubai Marina Mall",
    kind: "mall",
    lat: 25.07665,
    lng: 55.14021,
    hours: [{ days: EVERY_DAY, open: "10:00", close: "22:00" }],
    noteKey: "mall",
  },
  {
    id: "dxb-rakbank",
    city: "Dubai Marina",
    name: "RAKBANK Marina",
    kind: "bank",
    lat: 25.06951,
    lng: 55.1349,
    hours: [{ days: [1, 2, 3, 4], open: "08:00", close: "15:00" }, { days: [5], open: "08:00", close: "12:00" }],
    noteKey: "bank",
  },
  {
    id: "dxb-dib",
    city: "Dubai Marina",
    name: "Dubai Islamic Bank",
    kind: "bank",
    lat: 25.07847,
    lng: 55.13532,
    hours: [{ days: [1, 2, 3, 4], open: "08:00", close: "15:00" }, { days: [5], open: "08:00", close: "12:00" }],
    noteKey: "bank",
  },
  {
    id: "dxb-wharf",
    city: "Dubai Marina",
    name: "The Wharf, Marina Walk",
    kind: "mall",
    lat: 25.08002,
    lng: 55.12312,
    hours: [{ days: EVERY_DAY, open: "10:00", close: "23:00" }],
    noteKey: "mall",
  },
  {
    id: "dxb-bluewaters",
    city: "Dubai Marina",
    name: "Bluewaters Wharf Retail",
    kind: "mall",
    lat: 25.07814,
    lng: 55.12426,
    hours: [{ days: EVERY_DAY, open: "10:00", close: "23:00" }],
    noteKey: "mall",
  },
];

export function venuesForCity(city: string): Venue[] {
  return VENUES.filter((v) => v.city === city);
}

export function findVenue(idOrName: string | null | undefined): Venue | undefined {
  if (!idOrName) return undefined;
  return VENUES.find((v) => v.id === idOrName || v.name === idOrName);
}

export function isCity(value: string): value is City {
  return (CITIES as readonly string[]).includes(value);
}

/** Minutes since midnight in the city's local time, plus ISO weekday. */
function localClock(timeZone: string, now: Date): { minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  return { minutes: hour * 60 + Number(get("minute")), weekday: dayIndex + 1 };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Whether the venue is open right now in its own time zone (undefined when hours unknown). */
export function isOpenNow(venue: Venue, now = new Date()): boolean | undefined {
  if (!venue.hours?.length) return undefined;
  const { minutes, weekday } = localClock(CITY_META[venue.city].timeZone, now);
  return venue.hours.some(
    (slot) => slot.days.includes(weekday) && minutes >= toMinutes(slot.open) && minutes < toMinutes(slot.close)
  );
}

export function directionsUrl(venue: Venue): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${venue.lat},${venue.lng}`;
}

export function osmUrl(venue: Venue): string {
  return `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=18/${venue.lat}/${venue.lng}`;
}
