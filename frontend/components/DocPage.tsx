import Link from "next/link";

// Shared frame for the content pages (/how-it-works, /compliance): a title,
// an intro, and a column of sections. Content comes from messages/*.json so
// every page reads natively in EN/RU/TR.
export type DocSection = { title: string; paragraphs: string[]; bullets?: string[] };

export function DocPage({
  title,
  intro,
  sections,
  updated,
  cta,
}: {
  title: string;
  intro: string;
  sections: DocSection[];
  updated?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <article className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-base text-text-muted">{intro}</p>
      {updated && <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-text-dim">{updated}</p>}

      <div className="mt-8 flex flex-col gap-6">
        {sections.map((s) => (
          <section key={s.title} className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
            {s.paragraphs.map((p) => (
              <p key={p} className="mt-2 text-sm text-text-muted">
                {p}
              </p>
            ))}
            {s.bullets && s.bullets.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-text-muted">
                    <span className="mt-1 flex-none text-accent" aria-hidden="true">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {cta && (
        <Link
          href={cta.href}
          className="mt-8 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-accent-bright"
        >
          {cta.label}
        </Link>
      )}
    </article>
  );
}
