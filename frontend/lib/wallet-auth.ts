"use client";

// Browser/PWA wallet identity via Sign-In With Ethereum (EIP-4361). The user
// signs a SIWE message once with their connected wallet (a cold wallet, or the
// embedded wallet a Google/Apple login provisions); we persist the signed
// message and replay it as the `x-wallet-auth` header. The server re-verifies
// the signature on every request, so localStorage is not a trust boundary.

import { createSiweMessage, generateSiweNonce } from "viem/siwe";
import { LOGIN_CHANGE_EVENT } from "./telegram-login";

const STORAGE_KEY = "nomadia_wallet_auth";
const CHAIN_ID = 84532; // Base Sepolia (V0)

export type StoredWalletAuth = { address: string; message: string; signature: string };

/** Build the SIWE message a wallet signs to establish its Nomadia identity. */
export function buildSiweMessage(address: `0x${string}`): string {
  return createSiweMessage({
    address,
    chainId: CHAIN_ID,
    domain: window.location.host,
    uri: window.location.origin,
    version: "1",
    nonce: generateSiweNonce(),
    statement: "Sign in to Nomadia. This proves you control this wallet and is your identity here.",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

export function getStoredWalletAuth(): StoredWalletAuth | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d && typeof d === "object" && d.address && d.message && d.signature) return d as StoredWalletAuth;
    return null;
  } catch {
    return null;
  }
}

export function setStoredWalletAuth(data: StoredWalletAuth): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event(LOGIN_CHANGE_EVENT));
}

export function clearStoredWalletAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(LOGIN_CHANGE_EVENT));
}

/** base64(JSON({message, signature})) for the `x-wallet-auth` request header. */
export function getWalletAuthHeader(): string | null {
  const d = getStoredWalletAuth();
  if (!d) return null;
  try {
    return window.btoa(JSON.stringify({ message: d.message, signature: d.signature }));
  } catch {
    return null;
  }
}

export function getWalletAuthAddress(): string | null {
  return getStoredWalletAuth()?.address ?? null;
}
