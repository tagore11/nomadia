"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function NavBar() {
  const t = useTranslations("brand");

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/offers" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          {t("name")}
        </Link>
        {/* Telegram Mini App viewports run ~380-430px wide, and RU/TR labels
            run noticeably longer than EN — this row stays icon-first and
            compact rather than desktop-width text links. */}
        <nav className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/offers/mine"
            title={t("myOffers")}
            aria-label={t("myOffers")}
            className="flex h-8 items-center rounded-full border border-border-2 px-3 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent-bright"
          >
            {t("myOffers")}
          </Link>
          <Link
            href="/offers/new"
            title={t("postOffer")}
            aria-label={t("postOffer")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-2 text-lg leading-none text-foreground transition-colors hover:border-accent hover:text-accent-bright"
          >
            +
          </Link>
          {/* AppKit's connect button — its modal is what exposes email/Google/
              Apple sign-in, unlike RainbowKit's own connect UI which only
              lists wallets. */}
          <appkit-button size="md" />
        </nav>
      </div>
    </header>
  );
}
