import { decodeEventLog, type Log } from "viem";
import { ESCROW_ABI } from "./contracts";

/** Pulls the on-chain offerId out of a createOffer transaction receipt's logs. */
export function extractOfferIdFromReceipt(logs: readonly Log[]): bigint | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ESCROW_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "OfferCreated") {
        return (decoded.args as unknown as { offerId: bigint }).offerId;
      }
    } catch {
      // Log from a different event/contract — skip it.
    }
  }
  return null;
}
