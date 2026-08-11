// Multi-provider identity (D-018 superseded). A user is whoever they signed in
// as: a connected wallet, a Google/Apple embedded wallet (also a wallet address),
// or a Telegram account. Identity is a namespaced string so wallet and Telegram
// identities never collide, and it's what every offer/rating is keyed on.
//
// Tiers gate exposure: a light identity (wallet/social, cheap to farm) is capped
// at small trades; a phone-backed Telegram identity unlocks higher limits. This
// is the Sybil/scam mitigation for stranger-cash meetups — the cap IS the model.

export type IdentityProvider = "telegram" | "wallet";
export type IdentityTier = "light" | "phone";

export type AuthedUser = {
  id: string; // namespaced: "tg:<id>" | "wallet:<0x-lowercase>"
  provider: IdentityProvider;
  tier: IdentityTier;
  username?: string; // Telegram @handle, when present
  wallet?: string; // EVM address, for wallet-provider identities
};

// Per-trade USD ceiling by tier. USDC/USDT are treated as a 1 USD peg, so a
// trade's USD exposure is just its crypto amount (see tradeUsdValue).
export const TIER_MAX_USD: Record<IdentityTier, number> = {
  light: 100,
  phone: 1500, // aligns with the AML per-person guidance (docs/DECISIONS.md D-014)
};

export function tgIdentity(telegramId: string | number): string {
  return `tg:${telegramId}`;
}

export function walletIdentity(address: string): string {
  return `wallet:${address.toLowerCase()}`;
}

const STABLECOINS = new Set(["USDC", "USDT"]);

/** USD exposure of a trade. V0 only lists USDC/USDT (1 USD peg), so it's the
 * crypto amount; returns null for anything we can't price so callers can decide. */
export function tradeUsdValue(cryptoAmount: number, cryptoToken: string): number | null {
  if (!STABLECOINS.has(cryptoToken.toUpperCase())) return null;
  if (!(cryptoAmount > 0)) return null;
  return cryptoAmount;
}

/** True if this tier is allowed to take a trade of the given USD value. An
 * unpriceable trade (null) is allowed through — the escrow amount is still
 * capped on-chain and this is a V0 stablecoin-only concern. */
export function tierAllowsTrade(tier: IdentityTier, usdValue: number | null): boolean {
  if (usdValue == null) return true;
  return usdValue <= TIER_MAX_USD[tier];
}
