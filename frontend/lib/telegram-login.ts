"use client";

// Browser/PWA identity (D-018): the Telegram Login Widget hands back a signed
// payload once, which we persist and replay on every API call as the
// `x-telegram-login` header. The server re-verifies the HMAC on each request,
// so localStorage holding it is not a trust boundary — a tampered payload just
// fails verification.

import type { TelegramLoginData } from "./telegram";

const STORAGE_KEY = "nomadia_tg_login";

export function getStoredLogin(): TelegramLoginData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && "id" in data && "hash" in data) {
      return data as TelegramLoginData;
    }
    return null;
  } catch {
    return null;
  }
}

export const LOGIN_CHANGE_EVENT = "nomadia-login-change";

function emitChange(): void {
  window.dispatchEvent(new Event(LOGIN_CHANGE_EVENT));
}

export function setStoredLogin(data: TelegramLoginData): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  emitChange();
}

export function clearStoredLogin(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitChange();
}

/** Subscribe to sign-in/sign-out so useSyncExternalStore re-reads identity. */
export function subscribeLogin(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(LOGIN_CHANGE_EVENT, cb);
  window.addEventListener("storage", cb); // cross-tab sign-in
  return () => {
    window.removeEventListener(LOGIN_CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** base64(JSON) of the login payload for the `x-telegram-login` request header. */
export function getLoginHeader(): string | null {
  const data = getStoredLogin();
  if (!data) return null;
  try {
    return window.btoa(JSON.stringify(data));
  } catch {
    return null;
  }
}

export function getLoginTelegramId(): string | null {
  const data = getStoredLogin();
  return data ? String(data.id) : null;
}

export function getLoginUsername(): string | null {
  const data = getStoredLogin();
  return data && typeof data.username === "string" ? data.username : null;
}
