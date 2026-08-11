"use client";

import { useSyncExternalStore } from "react";
import { getTelegramWebApp } from "./telegram";
import { getStoredLogin, subscribeLogin } from "./telegram-login";
import { getStoredWalletAuth } from "./wallet-auth";

export type IdentityStatus = "miniapp" | "loggedin" | "anonymous";

function subscribe(cb: () => void) {
  // wallet-auth dispatches the same LOGIN_CHANGE_EVENT, so one subscription covers both.
  return subscribeLogin(cb);
}

function getSnapshot(): IdentityStatus {
  if (getTelegramWebApp()?.initData) return "miniapp";
  if (getStoredLogin() || getStoredWalletAuth()) return "loggedin";
  return "anonymous";
}

// Server render and first client paint must agree, so both start "anonymous"
// (no window). The real value resolves on mount via the store subscription.
function getServerSnapshot(): IdentityStatus {
  return "anonymous";
}

/** Whether the caller has a verifiable Telegram identity the API will accept. */
export function useIdentityStatus(): IdentityStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCanWrite(): boolean {
  return useIdentityStatus() !== "anonymous";
}
