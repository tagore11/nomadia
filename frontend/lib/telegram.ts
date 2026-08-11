import crypto from "node:crypto";

// Surface of the Telegram Mini App WebApp object we actually use.
// Full type: https://core.telegram.org/bots/webapps#initializing-mini-apps
export interface TelegramWebAppButton {
  text: string;
  isVisible: boolean;
  isActive: boolean;
  isProgressVisible: boolean;
  setText: (text: string) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
}

export interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

// https://core.telegram.org/bots/webapps#themeparams
export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name: string;
      username?: string;
      language_code?: string;
    };
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  viewportStableHeight: number;
  MainButton: TelegramWebAppButton;
  BackButton: TelegramWebAppButton;
  HapticFeedback: TelegramHapticFeedback;
  onEvent: (event: "themeChanged" | "viewportChanged" | "backButtonClicked", cb: () => void) => void;
  offEvent: (event: "themeChanged" | "viewportChanged" | "backButtonClicked", cb: () => void) => void;
  enableClosingConfirmation: () => void;
  disableClosingConfirmation: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * Whether we are ACTUALLY running inside Telegram, not merely that the Telegram
 * SDK script is loaded. `telegram-web-app.js` is included on every page, so it
 * defines `window.Telegram.WebApp` even in a plain browser — the real signal for
 * "inside a Mini App" is a non-empty `initData`. Using this (instead of "does the
 * WebApp object exist") is what keeps the in-page buttons visible in the browser
 * and PWA, where there is no native MainButton to fall back on.
 */
export function isInTelegram(): boolean {
  return !!getTelegramWebApp()?.initData;
}

/** No-op haptics outside Telegram, so call sites don't need an `if (tg)` guard. */
export function haptic() {
  const tg = getTelegramWebApp();
  return {
    impact: (style: Parameters<TelegramHapticFeedback["impactOccurred"]>[0] = "light") =>
      tg?.HapticFeedback.impactOccurred(style),
    notify: (type: Parameters<TelegramHapticFeedback["notificationOccurred"]>[0]) =>
      tg?.HapticFeedback.notificationOccurred(type),
    selection: () => tg?.HapticFeedback.selectionChanged(),
  };
}

// Identity payloads older than this are rejected as replays. Both Mini App
// initData and Login Widget data carry a fresh `auth_date` on every issue, so a
// generous but bounded window blocks captured-header replay without breaking a
// Mini App tab left open for a while.
const AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Constant-time hex compare so hash checks don't leak via timing. */
function safeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

function authDateFresh(authDate: string | null): boolean {
  if (!authDate) return false;
  const ts = Number(authDate);
  if (!Number.isFinite(ts)) return false;
  const ageSeconds = Math.floor(Date.now() / 1000) - ts;
  return ageSeconds >= 0 && ageSeconds <= AUTH_MAX_AGE_SECONDS;
}

/**
 * Verifies Telegram Mini App initData server-side per
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Requires TELEGRAM_BOT_TOKEN — without it, identity can't be trusted, so
 * callers must treat a missing token as "reject the request", not "skip the check".
 * Also rejects stale `auth_date` to block replay of a captured initData string.
 */
export function verifyTelegramInitData(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  if (!authDateFresh(params.get("auth_date"))) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return safeHexEqual(computedHash, hash);
}

export function parseTelegramUser(initData: string): { id: number; username?: string } | null {
  const params = new URLSearchParams(initData);
  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson);
    return { id: user.id, username: user.username };
  } catch {
    return null;
  }
}

// The Telegram Login Widget (browser/PWA sign-in outside the Mini App) returns a
// flat object {id, first_name, username?, photo_url?, auth_date, hash}. Its hash
// scheme differs from initData: the secret key is SHA256(bot_token), not
// HMAC(WebAppData, bot_token). https://core.telegram.org/widgets/login#checking-authorization
export type TelegramLoginData = Record<string, string | number | undefined> & {
  id: number | string;
  auth_date: number | string;
  hash: string;
  username?: string;
};

export function verifyTelegramLoginWidget(data: TelegramLoginData, botToken: string): boolean {
  const { hash } = data;
  if (!hash || typeof hash !== "string") return false;
  if (!authDateFresh(String(data.auth_date))) return false;

  const dataCheckString = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return safeHexEqual(computedHash, hash);
}
