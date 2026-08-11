"use client";

import { useEffect } from "react";
import { getTelegramWebApp, type TelegramThemeParams } from "@/lib/telegram";

const VAR_MAP: Partial<Record<keyof TelegramThemeParams, string>> = {
  bg_color: "--tg-bg-color",
  text_color: "--tg-text-color",
  hint_color: "--tg-hint-color",
  secondary_bg_color: "--tg-secondary-bg-color",
  section_bg_color: "--tg-section-bg-color",
};

function applyTheme() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(VAR_MAP) as [keyof TelegramThemeParams, string][]) {
    const value = tg.themeParams[key];
    if (value) root.style.setProperty(cssVar, value);
  }
  root.dataset.tgTheme = tg.colorScheme;
}

/** Renders nothing — just keeps app/globals.css's --tg-* variables in sync
 * with the user's live Telegram theme (see globals.css :root comment). */
export function TelegramThemeSync() {
  useEffect(() => {
    applyTheme();
    const tg = getTelegramWebApp();
    tg?.onEvent("themeChanged", applyTheme);
    return () => tg?.offEvent("themeChanged", applyTheme);
  }, []);

  return null;
}
