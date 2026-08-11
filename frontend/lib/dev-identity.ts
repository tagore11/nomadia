const STORAGE_KEY = "nomadia_dev_telegram_id";

/**
 * Stand-in identity for local testing before a real Telegram bot token exists
 * (see lib/auth.ts). Each browser profile gets a stable random id so two tabs
 * with different profiles can act as two different users end-to-end.
 */
export function getDevTelegramId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
