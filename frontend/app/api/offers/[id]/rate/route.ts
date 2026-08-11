import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { getOffer, insertRating, logEvent, upsertUser } from "@/lib/repo";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  await upsertUser(user);

  const { id } = await params;
  const offer = await getOffer(id);
  if (!offer) {
    return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404 });
  }
  if (offer.status !== "released") {
    return NextResponse.json({ error: "ONLY_RELEASED_CAN_BE_RATED" }, { status: 409 });
  }

  const isDepositor = offer.depositor_telegram_id === user.id;
  const isCounterparty = offer.counterparty_telegram_id === user.id;
  if (!isDepositor && !isCounterparty) {
    return NextResponse.json({ error: "NOT_PARTICIPANT" }, { status: 403 });
  }

  const { stars } = await request.json();
  if (typeof stars !== "number" || stars < 1 || stars > 5) {
    return NextResponse.json({ error: "INVALID_RATING" }, { status: 400 });
  }

  const ratedTelegramId = isDepositor ? offer.counterparty_telegram_id : offer.depositor_telegram_id;
  if (!ratedTelegramId) {
    return NextResponse.json({ error: "COUNTERPARTY_NOT_FOUND" }, { status: 409 });
  }

  const result = await insertRating({ offerId: id, raterId: user.id, ratedId: ratedTelegramId, stars });
  if (result === "already_rated") {
    return NextResponse.json({ error: "ALREADY_RATED" }, { status: 409 });
  }

  await logEvent("rating_submitted", { telegramId: user.id, offerId: id, props: { stars, rated: ratedTelegramId } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
