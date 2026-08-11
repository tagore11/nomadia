"use client";

import { useEffect } from "react";
import { getTelegramWebApp, isInTelegram } from "@/lib/telegram";

/**
 * The one primary call-to-action on a screen. Inside Telegram this drives
 * the native MainButton (rendered by the Telegram client itself, outside our
 * DOM) instead of an in-page button — per Telegram's own Mini App design
 * guidance, using MainButton for the core transactional action (locking
 * funds, confirming a trade) reads as a first-class app, not a website in a
 * frame. Outside Telegram (plain browser, used for local dev) it falls back
 * to a normal button so the app stays testable without a Telegram client.
 *
 * Only render one of these at a time — MainButton is a singleton native UI
 * element, not a per-component one.
 */
export function PrimaryAction({
  label,
  onClick,
  loading = false,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  // Only drive Telegram's native MainButton when ACTUALLY inside a Mini App.
  // The Telegram SDK script is loaded on every page, so `getTelegramWebApp()` is
  // truthy in a plain browser too — gating on that hid this button (and the
  // claim/confirm buttons) for every browser/PWA user. `isInTelegram()` checks
  // initData, the real signal.
  const inTelegram = isInTelegram();

  useEffect(() => {
    if (!inTelegram) return;
    const tg = getTelegramWebApp();
    if (!tg) return;
    const button = tg.MainButton;
    button.setText(label);
    if (disabled || loading) button.disable();
    else button.enable();
    if (loading) button.showProgress(true);
    else button.hideProgress();
    button.show();
    button.onClick(onClick);
    return () => {
      button.offClick(onClick);
      button.hide();
    };
  }, [inTelegram, label, onClick, loading, disabled]);

  if (inTelegram) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="rounded-full bg-accent px-5 py-2.5 font-medium text-accent-deep transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
