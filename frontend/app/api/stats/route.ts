import { NextResponse } from "next/server";
import { getStats } from "@/lib/repo";

// Aggregate investor metrics (no PII — counts only). Public read for now so the
// /stats dashboard can render; tighten with an admin gate before it holds real
// sensitive numbers.
export async function GET() {
  const stats = await getStats();
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
