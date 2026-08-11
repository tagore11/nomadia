import { NextResponse } from "next/server";
import { fetchReferenceRates } from "@/lib/rates";

// Live USD-base reference rates for the fairness signal. Cached in-process for
// an hour (see lib/rates.ts); returns 503 only if there's no cached fallback,
// in which case the client simply hides the fairness badge.
export async function GET() {
  const rates = await fetchReferenceRates(Date.now());
  if (!rates) {
    return NextResponse.json({ error: "RATES_UNAVAILABLE" }, { status: 503 });
  }
  return NextResponse.json(rates, {
    headers: { "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600" },
  });
}
