"use client";

import { useCallback, useSyncExternalStore } from "react";
import { locales, defaultLocale, type Locale } from "./i18n-config";
import { getTelegramWebApp } from "./telegram";

const STORAGE_KEY = "nomadia_locale";
const listeners = new Set<() => void>();

function normalizeLocale(input: string | undefined | null): Locale | null {
  if (!input) return null;
  const lower = input.toLowerCase();
  return (locales.find((l) => lower === l || lower.startsWith(`${l}-`)) as Locale | undefined) ?? null;
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  const stored = normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  if (stored) return stored;

  const tg = getTelegramWebApp();
  const tgLocale = normalizeLocale(tg?.initDataUnsafe.user?.language_code);
  if (tgLocale) return tgLocale;

  const browserLocale = normalizeLocale(window.navigator.language);
  if (browserLocale) return browserLocale;

  return defaultLocale;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getServerSnapshot(): Locale {
  return defaultLocale;
}

/** Manual choice > Telegram's own language_code > browser language > English. */
export function useLocale(): [Locale, (locale: Locale) => void] {
  const locale = useSyncExternalStore(subscribe, detectLocale, getServerSnapshot);

  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((notify) => notify());
  }, []);

  return [locale, setLocale];
}
