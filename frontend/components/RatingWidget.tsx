"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { apiFetch } from "@/lib/api-client";
import { useApiErrorMessage } from "@/lib/use-api-error-message";
import { haptic } from "@/lib/telegram";

export function RatingWidget({ offerId }: { offerId: number }) {
  const t = useTranslations("rating");
  const errorMessage = useApiErrorMessage();
  const [stars, setStars] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(value: number) {
    setStars(value);
    haptic().selection();
    try {
      await apiFetch(`/api/offers/${offerId}/rate`, {
        method: "POST",
        body: JSON.stringify({ stars: value }),
      });
      haptic().notify("success");
      setSubmitted(true);
    } catch (err) {
      haptic().notify("error");
      setError(errorMessage(err));
    }
  }

  if (submitted) {
    return <p className="text-sm text-accent-bright">{t("thanks")}</p>;
  }

  return (
    <div>
      <p className="text-sm text-text-muted">{t("prompt")}</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => submit(value)}
            aria-label={t("starLabel", { count: value })}
            className={`text-2xl leading-none transition-colors ${
              value <= stars ? "text-accent" : "text-border-2 hover:text-text-dim"
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
