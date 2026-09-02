"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { useIdentityStatus } from "@/lib/use-identity-status";
import { ANON_MAX_USD } from "@/lib/identity";
import { haptic } from "@/lib/telegram";
import { PrimaryAction } from "@/components/PrimaryAction";
import { FairnessBadge } from "@/components/FairnessBadge";
import type { OfferRow } from "@/lib/db";
import { CITIES } from "@/lib/venues";

const CRYPTO_TOKENS = ["USDC", "USDT"];
const FIAT_CURRENCIES = ["AED", "USD", "TRY"];

export default function NewOfferPage() {
  const router = useRouter();
  const { address } = useAccount();
  const t = useTranslations("newOffer");
  const errorMessage = useApiErrorMessage();
  const anonymous = useIdentityStatus() === "anonymous";

  const [direction, setDirection] = useState<OfferRow["direction"]>("crypto_to_fiat");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoToken, setCryptoToken] = useState(CRYPTO_TOKENS[0]);
  const [fiatAmount, setFiatAmount] = useState("");
  const [fiatCurrency, setFiatCurrency] = useState(FIAT_CURRENCIES[0]);
  const [city, setCity] = useState<string>(CITIES[0]);
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const { offer } = await apiFetch<{ offer: OfferRow }>("/api/offers", {
        method: "POST",
        body: JSON.stringify({
          direction,
          cryptoAmount: Number(cryptoAmount),
          cryptoToken,
          fiatAmount: Number(fiatAmount),
          fiatCurrency,
          city,
          contact: contact.trim() || undefined,
          wallet: address,
        }),
      });
      haptic().notify("success");
      router.push(`/offers/${offer.id}`);
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-1 text-sm text-text-muted">{t("subtitle")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-6 flex flex-col gap-5"
      >
        <fieldset className="flex gap-2">
          {(["crypto_to_fiat", "fiat_to_crypto"] as OfferRow["direction"][]).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => {
                haptic().selection();
                setDirection(value);
              }}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                direction === value ? "border-accent text-accent-bright" : "border-border-2 text-text-muted"
              }`}
            >
              {value === "crypto_to_fiat" ? t("directionCryptoToFiat") : t("directionFiatToCrypto")}
            </button>
          ))}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-muted">
            {t("cryptoAmount")}
            <input
              required
              type="number"
              min="0"
              step="0.000001"
              value={cryptoAmount}
              onChange={(e) => setCryptoAmount(e.target.value)}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground [font-variant-numeric:tabular-nums]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-muted">
            {t("token")}
            <select
              value={cryptoToken}
              onChange={(e) => setCryptoToken(e.target.value)}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground"
            >
              {CRYPTO_TOKENS.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text-muted">
            {t("fiatAmount")}
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={fiatAmount}
              onChange={(e) => setFiatAmount(e.target.value)}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground [font-variant-numeric:tabular-nums]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text-muted">
            {t("currency")}
            <select
              value={fiatCurrency}
              onChange={(e) => setFiatCurrency(e.target.value)}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground"
            >
              {FIAT_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-text-muted">
          {t("region")}
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground"
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-text-muted">
          {anonymous ? t("contactRequired") : t("contact")}
          <input
            type="text"
            required={anonymous}
            value={contact}
            maxLength={80}
            placeholder={t("contactPlaceholder")}
            onChange={(e) => setContact(e.target.value)}
            className="rounded-md border border-border-2 bg-surface px-3 py-2 text-foreground"
          />
          <span className="text-xs text-text-dim">{t("contactHint")}</span>
        </label>

        {anonymous && (
          <p className="rounded-md border border-border-2 bg-surface px-3 py-2 text-xs text-text-muted">
            {t("anonNote", { maxUsd: ANON_MAX_USD })}
          </p>
        )}

        {Number(cryptoAmount) > 0 && Number(fiatAmount) > 0 && (
          <FairnessBadge
            cryptoAmount={Number(cryptoAmount)}
            cryptoToken={cryptoToken}
            fiatAmount={Number(fiatAmount)}
            fiatCurrency={fiatCurrency}
            variant="full"
          />
        )}

        {direction === "crypto_to_fiat" && !address && (
          <p className="text-xs text-text-dim">{t("walletHint")}</p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {/* Native form submit stays as a fallback for keyboard/enter-to-submit;
            PrimaryAction drives the same submit() via Telegram's MainButton
            when running inside Telegram. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        <PrimaryAction
          label={submitting ? t("submitting") : t("submit")}
          onClick={submit}
          loading={submitting}
        />
      </form>
    </div>
  );
}
