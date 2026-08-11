"use client";

import { useEffect, useRef } from "react";
import { setStoredLogin } from "@/lib/telegram-login";
import type { TelegramLoginData } from "@/lib/telegram";

// Bot username (without @) whose domain is registered in BotFather (/setdomain)
// for the deployed origin. Defaults to the live bot so a missing env var doesn't
// silently break sign-in.
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "nomadp2pbot";

const CALLBACK_NAME = "onNomadiaTelegramAuth";

declare global {
  interface Window {
    [CALLBACK_NAME]?: (user: TelegramLoginData) => void;
  }
}

/**
 * Renders Telegram's official Login Widget button. On success Telegram calls our
 * global callback with a signed payload, which we persist; the server re-verifies
 * its HMAC on every request (see lib/auth.ts). Only meaningful in a browser/PWA —
 * inside the Mini App, initData already identifies the user.
 */
export function TelegramLoginWidget({ onAuth }: { onAuth?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window[CALLBACK_NAME] = (user: TelegramLoginData) => {
      setStoredLogin(user);
      onAuth?.();
    };

    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", BOT_USERNAME);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "10");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", `${CALLBACK_NAME}(user)`);
    container.appendChild(script);

    return () => {
      delete window[CALLBACK_NAME];
    };
  }, [onAuth]);

  return <div ref={containerRef} className="flex justify-center" />;
}
