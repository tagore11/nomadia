import type { OfferDirection } from "./offer-types";

/**
 * Only the crypto-holding side ever locks funds on-chain (docs/DECISIONS.md
 * D-002/D-005) — which DB role that is depends on the offer's direction, since
 * "depositor" here means "whoever posted the offer," not "whoever holds crypto."
 */
export function cryptoLockerRole(direction: OfferDirection): "depositor" | "counterparty" {
  return direction === "crypto_to_fiat" ? "depositor" : "counterparty";
}

export function receiverRole(direction: OfferDirection): "depositor" | "counterparty" {
  return cryptoLockerRole(direction) === "depositor" ? "counterparty" : "depositor";
}

export function myRole(
  offer: { depositor_telegram_id?: string; counterparty_telegram_id?: string | null },
  myTelegramId: string | null
): "depositor" | "counterparty" | "none" {
  if (!myTelegramId) return "none";
  if (offer.depositor_telegram_id === myTelegramId) return "depositor";
  if (offer.counterparty_telegram_id === myTelegramId) return "counterparty";
  return "none";
}
