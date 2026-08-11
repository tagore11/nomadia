"use client";

import { useSyncExternalStore } from "react";
import { getTelegramWebApp } from "./telegram";
import { getDevTelegramId } from "./dev-identity";
import { getLoginTelegramId, subscribeLogin } from "./telegram-login";
import { getWalletAuthAddress } from "./wallet-auth";
import { tgIdentity, walletIdentity } from "./identity";

// The caller's namespaced identity, matching exactly what the server's
// resolveUser() computes so role checks (offer-roles.myRole) line up. Priority
// mirrors the server: Mini App initData > Telegram Login > wallet SIWE > dev.
// wallet-auth dispatches the same login-change event, so one subscription covers
// wallet sign-in too.
function subscribe(cb: () => void) {
  return subscribeLogin(cb);
}

function getSnapshot(): string | null {
  const tg = getTelegramWebApp();
  if (tg?.initData && tg.initDataUnsafe.user) {
    return tgIdentity(tg.initDataUnsafe.user.id);
  }
  const loginId = getLoginTelegramId();
  if (loginId) return tgIdentity(loginId);

  const walletAddr = getWalletAuthAddress();
  if (walletAddr) return walletIdentity(walletAddr);

  // Dev fallback (local only; server namespaces the dev id as tg: and rejects it
  // in production).
  const devId = getDevTelegramId();
  return devId ? tgIdentity(devId) : null;
}

function getServerSnapshot(): string | null {
  return null;
}

/** The caller's namespaced identity id (tg:… | wallet:…), or null. */
export function useMyTelegramId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
