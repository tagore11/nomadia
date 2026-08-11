"use client";

import { useEffect } from "react";
import { getTelegramWebApp } from "@/lib/telegram";

/**
 * Renders nothing — patches window.open() to route through Telegram's
 * WebApp.openLink() while inside a Mini App.
 *
 * Telegram's in-app WebView sandboxes normal browser navigation: a wallet
 * deep-link (metamask://, trust://, the WalletConnect wallet-open call
 * RainbowKit fires when you tap a wallet in its connect modal) opened via
 * plain window.open()/location.href silently does nothing there. openLink()
 * hands the URL to the OS's real link handler instead, which does support
 * custom URI schemes — this is the documented fix for "wallet connect does
 * nothing inside a Telegram Mini App."
 */
export function TelegramLinkBridge() {
  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;

    // A stub for callers that check `.closed` / call `.close()` on the
    // return value — returning bare `null` broke that class of caller.
    // Reported as: RainbowKit's connect modal opened, but tapping a wallet
    // silently did nothing inside Telegram. Real window.open() itself may
    // also be sandboxed inside Telegram's WebView, so we don't try to open
    // a real window here either — just hand off to openLink and return a
    // fake already-closed window.
    const closedWindowStub = { closed: true, close: () => {}, focus: () => {} } as unknown as Window;

    const originalOpen = window.open.bind(window);
    window.open = (url?: string | URL, target?: string, features?: string): Window | null => {
      if (!url) return originalOpen(url, target, features);
      try {
        tg.openLink(String(url));
        return closedWindowStub;
      } catch {
        // openLink isn't actually available for some reason — fall back to
        // normal behavior rather than silently swallowing the click.
        return originalOpen(url, target, features);
      }
    };

    return () => {
      window.open = originalOpen;
    };
  }, []);

  return null;
}
