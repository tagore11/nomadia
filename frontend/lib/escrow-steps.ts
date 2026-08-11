import type { OfferStatus } from "./offer-types";

export type OnChainOfferView = {
  depositorConfirmed: boolean;
  counterpartyConfirmed: boolean;
  // From the escrow struct — used client-side to gate the refund button behind
  // the real on-chain timeout (createdAt in seconds) and to detect the
  // disputed/stuck states (status enum: 0 None,1 Open,2 Released,3 Refunded,4 Disputed).
  createdAt?: bigint;
  status?: number;
};

/**
 * Maps offer + on-chain confirmation state to one of 4 steps (see
 * components/EscrowStepper.tsx / messages/*.json "offerSteps"):
 * 0 accepted, 1 locked, 2 one side confirmed, 3 released.
 * Returns null before a match exists — there's nothing to track yet.
 */
export function computeEscrowStep(
  offer: { status: OfferStatus; chain_offer_id: number | null },
  onChainOffer: OnChainOfferView | undefined
): 0 | 1 | 2 | 3 | null {
  if (offer.status === "open") return null;
  if (offer.status === "released") return 3;
  if (!offer.chain_offer_id) return 0;
  if (!onChainOffer) return 1;
  if (onChainOffer.depositorConfirmed && onChainOffer.counterpartyConfirmed) return 3;
  if (onChainOffer.depositorConfirmed || onChainOffer.counterpartyConfirmed) return 2;
  return 1;
}
