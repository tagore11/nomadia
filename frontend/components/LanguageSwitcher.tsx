"use client";

import { useLocale } from "@/lib/use-locale";
import { locales, localeLabels } from "@/lib/i18n-config";
import { haptic } from "@/lib/telegram";

export function LanguageSwitcher() {
  const [locale, setLocale] = useLocale();

  return (
    <div className="flex rounded-full border border-border-2 p-0.5 font-mono text-xs">
      {locales.map((l) => (
        <button
          key={l}
          onClick={() => {
            haptic().selection();
            setLocale(l);
          }}
          aria-current={l === locale}
          className={`rounded-full px-2 py-1 transition-colors sm:px-2.5 ${
            l === locale ? "bg-accent-tint text-accent-bright" : "text-text-dim hover:text-text-muted"
          }`}
        >
          {localeLabels[l]}
        </button>
      ))}
    </div>
  );
}
