"use client";

import { useSyncExternalStore } from "react";
import { getTelegramWebApp } from "./telegram";

function subscribe(callback: () => void) {
  const tg = getTelegramWebApp();
  tg?.onEvent("themeChanged", callback);
  return () => tg?.offEvent("themeChanged", callback);
}

function getSnapshot(): "light" | "dark" {
  return getTelegramWebApp()?.colorScheme ?? "dark";
}

function getServerSnapshot(): "light" | "dark" {
  return "dark";
}

/** Follows the user's live Telegram theme; falls back to dark outside Telegram. */
export function useColorScheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
