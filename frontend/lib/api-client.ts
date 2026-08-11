import { getTelegramWebApp } from "./telegram";
import { getDevTelegramId } from "./dev-identity";
import { getLoginHeader, getStoredLogin } from "./telegram-login";
import { getWalletAuthHeader, getStoredWalletAuth } from "./wallet-auth";

/**
 * True only when the caller has NO verifiable identity — not in the Mini App,
 * not signed in via the Telegram Login Widget, and no wallet (SIWE) sign-in. In
 * production the write API rejects them until they sign in (see SignInGate).
 */
export function isDevIdentityMode(): boolean {
  return !getTelegramWebApp()?.initData && !getStoredLogin() && !getStoredWalletAuth();
}

/** True once a browser/PWA user has signed in (Telegram Login Widget or wallet SIWE). */
export function isBrowserLoggedIn(): boolean {
  return !getTelegramWebApp()?.initData && (!!getStoredLogin() || !!getStoredWalletAuth());
}

/**
 * error carries a machine-readable code (see messages/*.json "errors" namespace)
 * rather than user-facing text — API routes return codes, components translate
 * them with useTranslations("errors").
 */
export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;

  constructor(code: string, details: Record<string, unknown> = {}) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tg = getTelegramWebApp();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const loginHeader = getLoginHeader();
  const walletHeader = getWalletAuthHeader();
  if (tg?.initData) {
    headers.set("x-telegram-init-data", tg.initData);
  } else if (loginHeader) {
    headers.set("x-telegram-login", loginHeader);
  } else if (walletHeader) {
    headers.set("x-wallet-auth", walletHeader);
  } else {
    // Dev-only: server refuses this in production, so browser users must sign in
    // (wallet/Google/Apple or Telegram) before writes succeed.
    headers.set("x-dev-telegram-id", getDevTelegramId());
  }

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const { error, ...details } = body;
    throw new ApiError(error || "UNKNOWN_ERROR", details);
  }
  return res.json() as Promise<T>;
}
