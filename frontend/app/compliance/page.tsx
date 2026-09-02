"use client";

import { useTranslations } from "next-intl";
import { DocPage, type DocSection } from "@/components/DocPage";

const SECTIONS = ["what", "custody", "limits", "data", "status", "notYet", "responsibility", "contact"] as const;

// Written to be true today, not aspirational: what Nomadia does, what it
// records, what it does not yet do. Update this page before mainnet.
export default function CompliancePage() {
  const t = useTranslations("compliance");

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
      updated={t("updated")}
      cta={{ href: "/how-it-works", label: t("cta") }}
    />
  );
}
