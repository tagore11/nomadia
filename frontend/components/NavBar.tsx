"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useIdentityStatus } from "@/lib/use-identity-status";

export function NavBar() {
  const t = useTranslations("brand");
  // Mini App users skip the marketing home; the brand mark takes them to the board.
  const home = useIdentityStatus() === "miniapp" ? "/offers" : "/";

  return (
    <header className="border-b border-border">
      {/* Persistent testnet notice: it must be unmistakable on every screen
          that no real money moves — both a user-trust and a legal point. */}
      <div className="bg-amber-500/10 px-4 py-1 text-center text-[11px] font-medium uppercase tracking-wide text-amber-500">
        {t("testnetBadge")}
      </div>
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href={home} className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-accent">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          {t("name")}
        </Link>
        {/* Telegram Mini App viewports run ~380-430px wide, and RU/TR labels
            run noticeably longer than EN — this row stays icon-first and
            compact rather than desktop-width text links. */}
        <nav className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <Link
            href="/offers/mine"
            title={t("myOffers")}
            aria-label={t("myOffers")}
            className="flex h-8 w-8 items-center justify-center whitespace-nowrap rounded-full border border-border-2 text-xs text-text-muted transition-colors hover:border-accent hover:text-accent-bright sm:w-auto sm:px-3"
          >
            {/* Phone widths get the glyph; the label needs ~90-140px (RU) that
                the row cannot spare next to the connect button. */}
            <span className="text-base leading-none sm:hidden" aria-hidden="true">≡</span>
            <span className="hidden sm:inline">{t("myOffers")}</span>
          </Link>
          <Link
            href="/map"
            title={t("map")}
            aria-label={t("map")}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border-2 text-sm leading-none text-text-muted transition-colors hover:border-accent hover:text-accent-bright"
          >
            ◎
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
          <appkit-button size="sm" />
        </nav>
      </div>
    </header>
  );
}
