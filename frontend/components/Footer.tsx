"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useIdentityStatus } from "@/lib/use-identity-status";

export function Footer() {
  const t = useTranslations("footer");
  const status = useIdentityStatus();

  const links = [
    { href: "/", label: t("home") },
    { href: "/how-it-works", label: t("howItWorks") },
    { href: "/compliance", label: t("compliance") },
    { href: "/offers", label: t("offers") },
  ];

  return (
    <footer className="mt-8 border-t border-border">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-6 text-xs text-text-muted">
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-accent-bright">
              {l.label}
            </Link>
          ))}
          <a
            href="https://github.com/tagore11/nomadia"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-accent-bright"
          >
            GitHub
          </a>
          {status !== "miniapp" && (
            <a
              href="https://t.me/nomadp2pbot"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent-bright"
            >
              Telegram
            </a>
          )}
        </nav>
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-dim">{t("status")}</span>
      </div>
    </footer>
  );
}
