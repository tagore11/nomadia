import "server-only";
import { verifyMessage } from "viem";
import { parseSiweMessage } from "viem/siwe";

// Server-side verification of the `x-wallet-auth` header (base64 JSON of the
// SIWE message + signature). Stateless, mirroring the Telegram Login Widget
// path: the signature is re-checked on every request, and an expirationTime in
// the message bounds replay of a captured header. EOA-only for V0 (the common
// case for cold wallets and Reown's basic embedded wallets); a smart-contract
// (EIP-1271) wallet would need a public client and is out of V0 scope.

const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Returns the verified lowercase address, or null if the auth is invalid/expired. */
export async function verifyWalletAuth(header: string): Promise<string | null> {
  let message: string;
  let signature: `0x${string}`;
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    if (typeof decoded?.message !== "string" || typeof decoded?.signature !== "string") return null;
    message = decoded.message;
    signature = decoded.signature as `0x${string}`;
  } catch {
    return null;
  }

  let fields;
  try {
    fields = parseSiweMessage(message);
  } catch {
    return null;
  }
  const address = fields.address;
  if (!address) return null;

  // Freshness: reject expired, or issued implausibly far in the future.
  const now = Date.now();
  if (!fields.expirationTime || new Date(fields.expirationTime).getTime() < now) return null;
  if (fields.issuedAt && new Date(fields.issuedAt).getTime() > now + MAX_FUTURE_SKEW_MS) return null;

  let valid = false;
  try {
    valid = await verifyMessage({ address: address as `0x${string}`, message, signature });
  } catch {
    return null;
  }
  return valid ? address.toLowerCase() : null;
}
