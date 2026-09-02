"use client";

import { useTranslations } from "next-intl";
import { DocPage, type DocSection } from "@/components/DocPage";

// Section keys are enumerated here so the messages file stays flat and the
// three locales are trivially diffable for parity.
const SECTIONS = ["roles", "steps", "escrow", "price", "limits", "trust", "meetup", "dispute", "expiry"] as const;

export default function HowItWorksPage() {
  const t = useTranslations("howItWorks");

  const sections: DocSection[] = SECTIONS.map((k) => ({
    title: t(`${k}_title`),
    paragraphs: [t(`${k}_body`)],
    bullets: t.has(`${k}_b1`)
      ? [1, 2, 3, 4].filter((i) => t.has(`${k}_b${i}`)).map((i) => t(`${k}_b${i}`))
      : undefined,
  }));

  return (
    <DocPage
      title={t("title")}
      intro={t("intro")}
      sections={sections}
      cta={{ href: "/offers", label: t("cta") }}
    />
  );
}
