// Pure types shared by server and client. No runtime imports here (no
// better-sqlite3), so client components can `import type` these without pulling
// the DB driver into the browser bundle.

export type OfferDirection = "crypto_to_fiat" | "fiat_to_crypto";
export type OfferStatus = "open" | "matched" | "released" | "refunded" | "expired";

export type Reputation = { avgStars: number | null; ratingCount: number };

// What the API exposes about an offer (see lib/offer-view.ts). Raw Telegram IDs
// and contact fields are present only for the two participants of a trade;
// strangers see amounts, location, and reputation only.
export type PublicOffer = {
  id: number;
  chain_offer_id: number | null;
  direction: OfferDirection;
  crypto_amount: number;
  crypto_token: string;
  fiat_amount: number;
  fiat_currency: string;
  city: string;
  status: OfferStatus;
  created_at: string;
  expires_at: string;
  safe_zone: string | null;
  depositorReputation: Reputation;
  counterpartyReputation: Reputation | null;
  viewerRole: "depositor" | "counterparty" | null;
  depositor_wallet?: string | null;
  counterparty_wallet?: string | null;
  depositor_username?: string | null;
  counterparty_username?: string | null;
  depositor_contact?: string | null;
  counterparty_contact?: string | null;
  depositor_telegram_id?: string;
  counterparty_telegram_id?: string | null;
};
