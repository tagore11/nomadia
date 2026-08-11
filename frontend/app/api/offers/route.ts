import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/auth";
import { toPublicOffer } from "@/lib/offer-view";
import { listOpenOffers, insertOffer, logEvent, upsertUser } from "@/lib/repo";
import { tradeUsdValue, tierAllowsTrade, TIER_MAX_USD } from "@/lib/identity";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rows = await listOpenOffers({
    direction: searchParams.get("direction"),
    city: searchParams.get("city"),
  });

  // Resolve the caller optionally so their own offers still carry contact fields
  // in the list; strangers get the redacted projection (no IDs/wallets/contacts).
  const viewer = await resolveUser(request);
  const offers = await Promise.all(rows.map((row) => toPublicOffer(row, viewer?.id ?? null)));

  return NextResponse.json({ offers });
}

// A positive, finite amount within a sane ceiling — rejects negatives (which pass
// a naive truthiness check), NaN, Infinity, and absurd values.
function isValidAmount(v: unknown): v is number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 1_000_000_000;
}

function isValidShortString(v: unknown, maxLen: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.trim().length <= maxLen;
}

export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  await upsertUser(user);

  const body = await request.json();
  const { direction, cryptoAmount, cryptoToken, fiatAmount, fiatCurrency, city, wallet, contact } = body;

  if (
    (direction !== "crypto_to_fiat" && direction !== "fiat_to_crypto") ||
    !isValidAmount(cryptoAmount) ||
    !isValidShortString(cryptoToken, 16) ||
    !isValidAmount(fiatAmount) ||
    !isValidShortString(fiatCurrency, 8) ||
    !isValidShortString(city, 64)
  ) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  // Tier gate: a light identity (wallet/social) is capped per trade; only a
  // phone-backed Telegram identity clears higher-value offers.
  const usdValue = tradeUsdValue(Number(cryptoAmount), cryptoToken.trim());
  if (!tierAllowsTrade(user.tier, usdValue)) {
    return NextResponse.json(
      { error: "TRADE_LIMIT_EXCEEDED", maxUsd: TIER_MAX_USD[user.tier], tier: user.tier },
      { status: 403 }
    );
  }

  // Wallet, if provided, must look like an EVM address. A wallet-provider user's
  // own signed-in address is used as a fallback so escrow roles resolve.
  const depositorWallet =
    typeof wallet === "string" && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : user.wallet ?? null;
  const depositorContact = isValidShortString(contact, 80) ? contact.trim() : null;

  const offer = await insertOffer({
    direction,
    cryptoAmount: Number(cryptoAmount),
    cryptoToken: cryptoToken.trim(),
    fiatAmount: Number(fiatAmount),
    fiatCurrency: fiatCurrency.trim(),
    city: city.trim(),
    depositorId: user.id,
    depositorUsername: user.username ?? null,
    depositorWallet,
    depositorContact,
  });

  await logEvent("offer_created", {
    telegramId: user.id,
    offerId: offer.id,
    props: { direction, city: city.trim(), provider: user.provider },
  });
  return NextResponse.json({ offer: await toPublicOffer(offer, user.id) }, { status: 201 });
}
