// Reference exchange rates + fairness assessment.
//
// The single biggest trust/scam-prevention gap in the product review: a person
// about to hand over cash had no anchor for whether an offer's rate was fair.
// This computes an implied rate from the offer and compares it to a live market
// reference, so both the UI list and the detail page can flag "fair" vs a price
// that's suspiciously far from market (a classic scam vector).
//
// Stablecoin assumption for V0: USDC and USDT are treated as a 1 USD peg, so the
// reference "fiat per 1 crypto" is just the USD -> fiat FX rate.

export type FairnessVerdict = "fair" | "above" | "below" | "suspicious";

export type Fairness = {
  impliedPerCrypto: number; // fiat units the offer implies per 1 crypto unit
  referencePerCrypto: number; // market fiat per 1 crypto unit (USD peg)
  deltaPct: number; // signed % the implied rate sits vs market
  verdict: FairnessVerdict;
};

export type ReferenceRates = {
  base: "USD";
  rates: Record<string, number>; // fiat units per 1 USD
  updatedAt: string; // ISO
};

const STABLECOINS = new Set(["USDC", "USDT"]);
// Rates move daily and the reference is a live-but-approximate anchor, so "fair"
// is an advisory band, not a hard line: anything within ±3% of the market
// reference reads as fair. Beyond ±15% is flagged as far from market.
const FAIR_BAND = 3;
const SUSPICIOUS_BAND = 15;

/**
 * Pure, isomorphic fairness check — no network. Returns null when it can't be
 * assessed (non-stablecoin token, missing/zero inputs, or no reference rate),
 * so callers simply omit the signal rather than showing something misleading.
 */
export function assessFairness(args: {
  cryptoAmount: number;
  cryptoToken: string;
  fiatAmount: number;
  fiatCurrency: string;
  rates: ReferenceRates | null | undefined;
}): Fairness | null {
  const { cryptoAmount, cryptoToken, fiatAmount, fiatCurrency, rates } = args;
  if (!rates) return null;
  if (!STABLECOINS.has(cryptoToken.toUpperCase())) return null;
  if (!(cryptoAmount > 0) || !(fiatAmount > 0)) return null;

  const referencePerCrypto = rates.rates[fiatCurrency.toUpperCase()];
  if (!(referencePerCrypto > 0)) return null;

  const impliedPerCrypto = fiatAmount / cryptoAmount;
  const deltaPct = ((impliedPerCrypto - referencePerCrypto) / referencePerCrypto) * 100;

  let verdict: FairnessVerdict;
  if (Math.abs(deltaPct) >= SUSPICIOUS_BAND) verdict = "suspicious";
  else if (Math.abs(deltaPct) <= FAIR_BAND) verdict = "fair";
  else verdict = deltaPct > 0 ? "above" : "below";

  return { impliedPerCrypto, referencePerCrypto, deltaPct, verdict };
}

// --- server-only live reference fetch (cached) ---------------------------

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cache: { data: ReferenceRates; at: number } | null = null;

// Free, no-key FX endpoint. USDC/USDT peg to USD, so USD-base FX is all we need.
const FX_URL = "https://open.er-api.com/v6/latest/USD";
const SUPPORTED = ["USD", "TRY", "AED", "EUR", "RUB"];

/**
 * Live USD-base reference rates, cached in-process for an hour. Returns null on
 * any failure so the fairness signal degrades to "hidden" rather than breaking
 * a page. Server-only (called from the /api/rates route).
 */
export async function fetchReferenceRates(now: number): Promise<ReferenceRates | null> {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.data;
  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return cache?.data ?? null;
    const json = await res.json();
    if (json?.result !== "success" || !json?.rates) return cache?.data ?? null;

    const rates: Record<string, number> = {};
    for (const code of SUPPORTED) {
      const v = json.rates[code];
      if (typeof v === "number" && v > 0) rates[code] = v;
    }
    rates.USD = 1;

    const data: ReferenceRates = {
      base: "USD",
      rates,
      updatedAt: new Date((json.time_last_update_unix ?? Math.floor(now / 1000)) * 1000).toISOString(),
    };
    cache = { data, at: now };
    return data;
  } catch {
    return cache?.data ?? null;
  }
}

// --- match-time snapshot ---------------------------------------------------
// When an offer is claimed, the market reference is frozen alongside the trade
// so a later dispute ("the rate was unfair") can be judged against the price
// both sides saw at the moment they committed, not against today's market.

export type RateSnapshot = {
  fiatCurrency: string;
  /** Market fiat units per 1 crypto unit at match time. */
  referencePerCrypto: number;
  /** Fiat units per 1 crypto unit implied by the offer itself. */
  impliedPerCrypto: number;
  deltaPct: number;
  /** ISO timestamp of the reference rate (not of the match). */
  referenceAt: string;
  /** ISO timestamp of the match. */
  at: string;
};

/** Builds a snapshot for an offer, or null when no reference is available. */
export function buildRateSnapshot(args: {
  cryptoAmount: number;
  cryptoToken: string;
  fiatAmount: number;
  fiatCurrency: string;
  rates: ReferenceRates | null;
  now: number;
}): RateSnapshot | null {
  const f = assessFairness(args);
  if (!f || !args.rates) return null;
  return {
    fiatCurrency: args.fiatCurrency.toUpperCase(),
    referencePerCrypto: f.referencePerCrypto,
    impliedPerCrypto: f.impliedPerCrypto,
    deltaPct: f.deltaPct,
    referenceAt: args.rates.updatedAt,
    at: new Date(args.now).toISOString(),
  };
}

/** Parses a stored snapshot column; tolerant of nulls and bad JSON. */
export function parseRateSnapshot(raw: string | null | undefined): RateSnapshot | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.referencePerCrypto !== "number" || typeof v?.fiatCurrency !== "string") return null;
    return v as RateSnapshot;
  } catch {
    return null;
  }
}
