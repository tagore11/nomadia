"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useFormatter } from "next-intl";
import { getTelegramWebApp } from "@/lib/telegram";
import type { Stats } from "@/lib/repo";

// The front door for browser visitors. Telegram Mini App users already know
// what Nomadia is (they opened it from the bot), so they go straight to the
// board. Everything here is either live data or a plain statement of how the
// product works today — no invented traction.
export default function HomePage() {
  const t = useTranslations("landing");
  const tProtection = useTranslations("protection");
  const format = useFormatter();
  const router = useRouter();

  useEffect(() => {
    if (getTelegramWebApp()?.initData) router.replace("/offers");
  }, [router]);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error("stats");
      return (await res.json()) as Stats;
    },
    staleTime: 60_000,
  });

  const n = (v: number | undefined) => (v == null ? "·" : format.number(v));
  const released = stats?.offers.byStatus.released ?? 0;

  const steps = [1, 2, 3, 4].map((i) => ({
    title: t(`step${i}Title`),
    body: t(`step${i}Body`),
  }));
  const trust = ["limits", "price", "reputation", "vouch"] as const;
  const cities = ["Kaş", "Antalya", "İstanbul", "Dubai", "Tbilisi"];

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-10">
      {/* Hero */}
      <section>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{t("eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          {t("headline")}
        </h1>
        <p className="mt-4 max-w-xl text-base text-text-muted">{t("subhead")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/offers"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-bright"
          >
            {t("ctaBrowse")}
          </Link>
          <Link
            href="/offers/new"
            className="rounded-full border border-border-2 px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent hover:text-accent-bright"
          >
            {t("ctaPost")}
          </Link>
        </div>
        <p className="mt-3 text-xs text-text-dim">{t("testnetNote")}</p>
      </section>

      {/* Live numbers */}
      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("statMembers"), value: n(stats?.users.total) },
          { label: t("statOffers"), value: n(stats?.offers.total) },
          { label: t("statReleased"), value: n(stats ? released : undefined) },
          { label: t("statVouched"), value: n(stats?.vouchedUsers) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <div className="font-mono text-2xl text-foreground [font-variant-numeric:tabular-nums]">{s.value}</div>
            <div className="mt-1 text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </section>
      <p className="mt-2 text-xs text-text-dim">{t("statsHint")}</p>

      {/* How it works */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold text-foreground">{t("howTitle")}</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-border bg-surface p-4">
              <div className="font-mono text-[11px] uppercase tracking-wider text-accent">0{i + 1}</div>
              <div className="mt-1 text-sm font-semibold text-foreground">{s.title}</div>
              <p className="mt-1 text-sm text-text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="mt-4 inline-block text-sm text-accent-bright underline decoration-dotted">
          {t("howLink")}
        </Link>
      </section>

      {/* Protection */}
      <section className="mt-14 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <span className="text-accent-bright" aria-hidden="true">◈</span>
          <h2 className="text-base font-semibold text-foreground">{tProtection("title")}</h2>
        </div>
        <ul className="mt-3 flex flex-col gap-2.5">
          {[tProtection("lockedPoint"), tProtection("confirmPoint"), tProtection("disputePoint")].map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-text-muted">
              <span className="mt-1 flex-none text-accent" aria-hidden="true">✓</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-lg border border-border-2 bg-accent-tint px-3 py-2.5 text-sm font-medium text-foreground">
          {tProtection("caution")}
        </p>
      </section>

      {/* Trust layers */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold text-foreground">{t("trustTitle")}</h2>
        <p className="mt-1 text-sm text-text-muted">{t("trustSubtitle")}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {trust.map((k) => (
            <div key={k} className="rounded-lg border border-border bg-surface p-4">
              <div className="text-sm font-semibold text-foreground">{t(`trust_${k}_title`)}</div>
              <p className="mt-1 text-sm text-text-muted">{t(`trust_${k}_body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cities */}
      <section className="mt-14">
        <h2 className="text-xl font-semibold text-foreground">{t("citiesTitle")}</h2>
        <p className="mt-1 text-sm text-text-muted">{t("citiesBody")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {cities.map((c, i) => (
            <span
              key={c}
              className={`rounded-full border px-3 py-1 font-mono text-xs ${
                i === 0 ? "border-accent text-accent-bright" : "border-border-2 text-text-muted"
              }`}
            >
              {c}
              {i === 0 && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-accent">{t("pilot")}</span>}
            </span>
          ))}
        </div>
        <Link href="/map" className="mt-4 inline-block text-sm text-accent-bright underline decoration-dotted">
          {t("mapLink")}
        </Link>
      </section>

      {/* Closing CTA */}
      <section className="mt-14 rounded-2xl border border-border-2 bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">{t("closingTitle")}</h2>
        <p className="mt-1 text-sm text-text-muted">{t("closingBody")}</p>
        <Link
          href="/offers/new"
          className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-bright"
        >
          {t("ctaPost")}
        </Link>
      </section>
    </div>
  );
}
