import { NextRequest, NextResponse } from "next/server";
import type { OfferRow } from "@/lib/db";
import { resolveUser } from "@/lib/auth";
import { toPublicOffer } from "@/lib/offer-view";
import { getOffer, claimOffer, updateOfferByParticipant, logEvent, upsertUser } from "@/lib/repo";
import { buildRateSnapshot, fetchReferenceRates } from "@/lib/rates";
import { tradeUsdValue, tierAllowsTrade, TIER_MAX_USD } from "@/lib/identity";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const offer = await getOffer(id);
  if (!offer) {
    return NextResponse.json({ error: "OFFER_NOT_FOUND" }, { status: 404 });
  }
  // Optional auth: participants get contact/wallet fields, strangers get the
  // redacted projection. Either way, raw identities never leak to non-parties.
  const viewer = await resolveUser(request);
  return NextResponse.json({ offer: await toPublicOffer(offer, viewer?.id ?? null) });
}

const ALLOWED_TRANSITIONS: Record<OfferRow["status"], OfferRow["status"][]> = {
  open: ["matched", "expired"],
  matched: ["released", "refunded"],
  released: [],
  refunded: [],
  expired: [],
};

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json();
  const { status, counterpartyWallet, chainOfferId, safeZone, contact } = body;

  const cpWallet =
    typeof counterpartyWallet === "string" && EVM_ADDRESS.test(counterpartyWallet) ? counterpartyWallet : null;
  const cpContact = typeof contact === "string" && contact.trim().length <= 80 ? contact.trim() || null : null;
  const chainId =
    typeof chainOfferId === "number" && Number.isInteger(chainOfferId) && chainOfferId >= 0 ? chainOfferId : null;
  const zone = typeof safeZone === "string" && safeZone.trim().length <= 120 ? safeZone.trim() : null;

  const isClaimingOpenOffer = status === "matched" && offer.status === "open";

  if (isClaimingOpenOffer) {
    if (offer.depositor_telegram_id === user.id) {
      return NextResponse.json({ error: "SELF_MATCH" }, { status: 400 });
    }
    // Tier gate: the claimer is exposed to the full trade value, so a light
    // identity can't take an offer above its cap either.
    const usdValue = tradeUsdValue(offer.crypto_amount, offer.crypto_token);
    if (!tierAllowsTrade(user.tier, usdValue)) {
      return NextResponse.json(
        { error: "TRADE_LIMIT_EXCEEDED", maxUsd: TIER_MAX_USD[user.tier], tier: user.tier },
        { status: 403 }
      );
    }
    // Freeze the market reference at the moment of commitment (dispute evidence).
    const now = Date.now();
    const snapshot = buildRateSnapshot({
      cryptoAmount: offer.crypto_amount,
      cryptoToken: offer.crypto_token,
      fiatAmount: offer.fiat_amount,
      fiatCurrency: offer.fiat_currency,
      rates: await fetchReferenceRates(now),
      now,
    });
    // Atomic conditional claim (WHERE status='open'): a racing second claimer
    // gets null instead of both winning.
    const claimed = await claimOffer(id, {
      userId: user.id,
      username: user.username ?? null,
      cpWallet: cpWallet ?? user.wallet ?? null,
      cpContact,
      chainId,
      rateSnapshot: snapshot ? JSON.stringify(snapshot) : null,
    });
    if (!claimed) {
      return NextResponse.json({ error: "OFFER_ALREADY_MATCHED" }, { status: 409 });
    }
    await logEvent("offer_matched", { telegramId: user.id, offerId: id });
    return NextResponse.json({ offer: await toPublicOffer(claimed, user.id) });
  }

  // Every non-claim update requires the caller to already be a participant.
  const isParticipant =
    offer.depositor_telegram_id === user.id || offer.counterparty_telegram_id === user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "NOT_PARTICIPANT" }, { status: 403 });
  }

  if (status && !ALLOWED_TRANSITIONS[offer.status]?.includes(status)) {
    return NextResponse.json({ error: "INVALID_TRANSITION", from: offer.status, to: status }, { status: 409 });
  }

  const updated = await updateOfferByParticipant(id, { status: status ?? null, cpWallet, chainId, safeZone: zone });

  if (chainId != null && offer.chain_offer_id == null) {
    await logEvent("offer_locked", { telegramId: user.id, offerId: id });
  }
  if (status === "released" && offer.status !== "released") {
    await logEvent("offer_released", { telegramId: user.id, offerId: id });
  }
  if (status === "refunded" && offer.status !== "refunded") {
    await logEvent("offer_refunded", { telegramId: user.id, offerId: id });
  }

  return NextResponse.json({ offer: await toPublicOffer(updated, user.id) });
}
