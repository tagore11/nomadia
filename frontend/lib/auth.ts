import { NextRequest } from "next/server";
import {
  verifyTelegramInitData,
  parseTelegramUser,
  verifyTelegramLoginWidget,
  type TelegramLoginData,
} from "./telegram";
import { verifyWalletAuth } from "./wallet-auth-server";
import { type AuthedUser, tgIdentity, walletIdentity } from "./identity";

export type { AuthedUser } from "./identity";

/**
 * Resolves the caller's identity across every supported provider. A user is
 * whoever they proved they are, in priority order:
 *   1. Telegram Mini App   -> `x-telegram-init-data`  (phone-backed tier)
 *   2. Telegram Login (web) -> `x-telegram-login`      (phone-backed tier)
 *   3. Wallet / social (web)-> `x-wallet-auth` (SIWE)  (light tier, wallet or
 *                                                       Google/Apple embedded wallet)
 * A dev-only `x-dev-telegram-id` header is honored ONLY outside production so
 * the app stays testable locally; never trusted in production.
 */
export async function resolveUser(request: NextRequest): Promise<AuthedUser | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (botToken) {
    const initData = request.headers.get("x-telegram-init-data");
    if (initData) {
      if (!verifyTelegramInitData(initData, botToken)) return null;
      const user = parseTelegramUser(initData);
      if (!user) return null;
      return {
        id: tgIdentity(user.id),
        provider: "telegram",
        tier: "phone",
        username: user.username,
      };
    }

    const loginHeader = request.headers.get("x-telegram-login");
    if (loginHeader) {
      const data = decodeLoginHeader(loginHeader);
      if (!data) return null;
      if (!verifyTelegramLoginWidget(data, botToken)) return null;
      return {
        id: tgIdentity(String(data.id)),
        provider: "telegram",
        tier: "phone",
        username: typeof data.username === "string" ? data.username : undefined,
      };
    }
  }

  // Wallet / social sign-in (SIWE). Works with no bot token configured.
  const walletHeader = request.headers.get("x-wallet-auth");
  if (walletHeader) {
    const address = await verifyWalletAuth(walletHeader);
    if (!address) return null;
    return {
      id: walletIdentity(address),
      provider: "wallet",
      tier: "light",
      wallet: address,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    const devId = request.headers.get("x-dev-telegram-id");
    if (devId) {
      // Dev identities default to the phone tier so existing local tests keep
      // full access; `x-dev-tier: light` opts a dev user into the capped tier.
      const tier = request.headers.get("x-dev-tier") === "light" ? "light" : "phone";
      return { id: tgIdentity(devId), provider: "telegram", tier };
    }
  }

  return null;
}

function decodeLoginHeader(header: string): TelegramLoginData | null {
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const data = JSON.parse(json);
    if (data && typeof data === "object" && "id" in data && "hash" in data && "auth_date" in data) {
      return data as TelegramLoginData;
    }
    return null;
  } catch {
    return null;
  }
}
