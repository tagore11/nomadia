"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "./api-client";

/** Translates an ApiError's machine code (see messages/*.json "errors") into
 * user-facing text, filling in the {from}/{to} status labels for
 * INVALID_TRANSITION from their own translated names rather than raw DB values. */
export function useApiErrorMessage() {
  const tErrors = useTranslations("errors");
  const tStatus = useTranslations("offerStatus");

  return (err: unknown): string => {
    if (!(err instanceof ApiError)) return tErrors("UNKNOWN_ERROR");

    try {
      if (err.code === "INVALID_TRANSITION") {
        return tErrors("INVALID_TRANSITION", {
          from: tStatus(err.details.from as "open" | "matched" | "released" | "refunded" | "expired"),
          to: tStatus(err.details.to as "open" | "matched" | "released" | "refunded" | "expired"),
        });
      }
      if (err.code === "TRADE_LIMIT_EXCEEDED") {
        return tErrors("TRADE_LIMIT_EXCEEDED", { maxUsd: Number(err.details.maxUsd) || 100 });
      }
      return tErrors(err.code as Parameters<typeof tErrors>[0]);
    } catch {
      return tErrors("UNKNOWN_ERROR");
    }
  };
}
