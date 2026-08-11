"use client";

import { useQuery } from "@tanstack/react-query";
import type { Stats } from "@/lib/repo";

function pct(n: number, d: number): string {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground [font-variant-numeric:tabular-nums]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 flex-none text-text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-border-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-10 flex-none text-right font-mono text-foreground [font-variant-numeric:tabular-nums]">{value}</span>
    </div>
  );
}

export default function StatsPage() {
  const { data, isLoading, error } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("stats");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-5 py-8 text-text-muted">Yükleniyor…</div>;
  if (error || !data) return <div className="mx-auto max-w-3xl px-5 py-8 text-danger">İstatistik yüklenemedi.</div>;

  const created = data.funnel.offer_created ?? 0;
  const matched = data.funnel.offer_matched ?? 0;
  const released = data.funnel.offer_released ?? 0;
  const funnelMax = Math.max(created, 1);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-2xl font-bold text-foreground">Nomadia — Metrikler</h1>
      <p className="mt-1 text-sm text-text-muted">Kayıt, teklif ve dönüşüm verileri (canlı). Yatırımcı görünümü.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Kayıtlı kullanıcı" value={data.users.total} />
        <Stat label="Toplam teklif" value={data.offers.total} />
        <Stat label="Tamamlanan işlem" value={released} sub={`teklifin ${pct(released, created)}'i`} />
        <Stat label="Tekrar eden poster" value={data.repeatPosters} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">Dönüşüm hunisi</h2>
        <div className="mt-3 flex flex-col gap-2">
          <Bar label="Teklif açıldı" value={created} max={funnelMax} />
          <Bar label="Eşleşti" value={matched} max={funnelMax} />
          <Bar label="Kilitlendi" value={data.funnel.offer_locked ?? 0} max={funnelMax} />
          <Bar label="Tamamlandı" value={released} max={funnelMax} />
          <Bar label="Puanlandı" value={data.funnel.rating_submitted ?? 0} max={funnelMax} />
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Eşleşme oranı {pct(matched, created)} · Tamamlanma {pct(released, matched)} (eşleşenler içinde)
        </p>
      </section>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-foreground">Kayıt yöntemi</h2>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(data.users.byProvider).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={data.users.total} />
            ))}
            {data.users.total === 0 && <p className="text-sm text-text-dim">Henüz kayıt yok.</p>}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-foreground">Teklif durumu</h2>
          <div className="mt-3 flex flex-col gap-2">
            {Object.entries(data.offers.byStatus).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={data.offers.total} />
            ))}
            {data.offers.total === 0 && <p className="text-sm text-text-dim">Henüz teklif yok.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
