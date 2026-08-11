import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { toPublicOffer } from "@/lib/offer-view";
import { listUserOffers } from "@/lib/repo";

// Every offer the caller is part of, active or finished — the surface that lets
// a poster find and return to their own in-flight trades. Static `mine` segment
// resolves before the dynamic `[id]` route.
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const rows = await listUserOffers(user.id);
  const offers = await Promise.all(rows.map((row) => toPublicOffer(row, user.id)));
  return NextResponse.json({ offers });
}
