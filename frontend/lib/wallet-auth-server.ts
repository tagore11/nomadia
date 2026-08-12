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
const CHAIN_ID = 84532; // Base Sepolia (V0) — must match lib/wallet-auth.ts
// Domains this deployment will accept a SIWE message for. A signature is only
// identity proof if it was issued FOR Nomadia: without this check any valid
// SIWE signature the user made on any other dApp could be replayed here as
// login (EIP-4361's whole point is domain binding). Env override lets preview
// deploys add their own host.
const ALLOWED_DOMAINS = new Set(
  [
    "nomadia-app.vercel.app",
    process.env.NEXT_PUBLIC_SIWE_DOMAIN,
    process.env.NODE_ENV !== "production" ? "localhost:3000" : null,
  ].filter((d): d is string => Boolean(d))
);

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

  // Domain/chain binding: the message must have been signed FOR this app on the
  // expected chain, not captured from another dApp and replayed here.
  if (!fields.domain || !ALLOWED_DOMAINS.has(fields.domain)) return null;
  if (fields.chainId !== CHAIN_ID) return null;

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
