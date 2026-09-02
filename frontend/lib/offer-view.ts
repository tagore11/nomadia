import { getReputation, getVouchInfo } from "./repo";
import { parseRateSnapshot } from "./rates";
import type { OfferRow } from "./db";
import type { PublicOffer } from "./offer-types";

export type { PublicOffer } from "./offer-types";

export async function toPublicOffer(offer: OfferRow, viewerTelegramId: string | null): Promise<PublicOffer> {
  const isDepositor = viewerTelegramId != null && offer.depositor_telegram_id === viewerTelegramId;
  const isCounterparty =
    viewerTelegramId != null && offer.counterparty_telegram_id === viewerTelegramId;
  const isParticipant = isDepositor || isCounterparty;

  const [depositorReputation, counterpartyReputation, vouch] = await Promise.all([
    getReputation(offer.depositor_telegram_id),
    offer.counterparty_telegram_id ? getReputation(offer.counterparty_telegram_id) : Promise.resolve(null),
    getVouchInfo(offer.depositor_telegram_id),
  ]);
  const snapshot = parseRateSnapshot(offer.match_rate_snapshot);

  const base: PublicOffer = {
    id: offer.id,
    chain_offer_id: offer.chain_offer_id,
    direction: offer.direction,
    crypto_amount: offer.crypto_amount,
    crypto_token: offer.crypto_token,
    fiat_amount: offer.fiat_amount,
    fiat_currency: offer.fiat_currency,
    city: offer.city,
    status: offer.status,
    created_at: offer.created_at,
    expires_at: offer.expires_at,
    safe_zone: offer.safe_zone,
    depositorReputation,
    counterpartyReputation,
    depositorVouchedBy: vouch.vouchedBy,
    depositorVouchCount: vouch.vouchCount,
    matchRate: snapshot
      ? {
          fiatCurrency: snapshot.fiatCurrency,
          referencePerCrypto: snapshot.referencePerCrypto,
          impliedPerCrypto: snapshot.impliedPerCrypto,
          deltaPct: snapshot.deltaPct,
          at: snapshot.at,
        }
      : null,
    viewerRole: isDepositor ? "depositor" : isCounterparty ? "counterparty" : null,
  };

  if (isParticipant) {
    // Participants get contact + wallets + identity echo so the meetup can happen
    // and the client can drive escrow roles.
    base.depositor_telegram_id = offer.depositor_telegram_id;
    base.counterparty_telegram_id = offer.counterparty_telegram_id;
    base.depositor_username = offer.depositor_username;
    base.counterparty_username = offer.counterparty_username;
    base.depositor_wallet = offer.depositor_wallet;
    base.counterparty_wallet = offer.counterparty_wallet;
    base.depositor_contact = offer.depositor_contact;
    base.counterparty_contact = offer.counterparty_contact;
  }

  return base;
}
