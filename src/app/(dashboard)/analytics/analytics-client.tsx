"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

const STALL_DAYS = 7;

type Stats = {
  totalLeads: number;
  convertedCount: number;
  conversionRate: number;
  avgDaysToConvert: number | null;
  medianDaysToConvert: number | null;
  openCount: number;
  lostCount: number;
  avgAgeOpenLeads: number | null;
  stalledCount: number;
};

type Funnel =
  | { type: "by_stage"; stages: { id: string; name: string; kind: string | null; position: number; currentCount: number; reachedCount: number }[] }
  | { type: "by_kind"; new: number; in_progress: number; converted: number; lost: number };

type SourceRow = { source: string; total: number; converted: number; rate: number };
type TempRow = { total: number; converted: number; rate: number };

export function AnalyticsClient({
  stats,
  funnel,
  bySource,
  byTemp,
  smallSample,
  bootcampId,
  bootcamps,
}: {
  stats: Stats;
  funnel: Funnel;
  bySource: SourceRow[];
  byTemp: { hot: TempRow; cold: TempRow };
  smallSample: boolean;
  bootcampId: string | null;
  bootcamps: { id: string; name: string }[];
}) {
  const router = useRouter();

  function switchBootcamp(id: string) {
    const sp = new URLSearchParams();
    if (id) sp.set("bootcamp", id);
    const qs = sp.toString();
    router.push(`/analytics${qs ? `?${qs}` : ""}`);
  }

  function pct(v: number) {
    return `${(v * 100).toFixed(1)} %`;
  }

  function daysLabel(d: number | null) {
    if (d === null) return "—";
    const rounded = Math.round(d * 10) / 10;
    return `${rounded} j`;
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={bootcampId
          ? `Formation : ${bootcamps.find((b) => b.id === bootcampId)?.name || "—"}`
          : "Toutes formations"}
        actions={
          <select
            value={bootcampId || ""}
            onChange={(e) => switchBootcamp(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
          >
            <option value="">Toutes les formations</option>
            {bootcamps.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        }
      />
      <div className="flex-1 overflow-y-auto p-5">
        {smallSample && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            Échantillon faible ({stats.convertedCount} converti{stats.convertedCount > 1 ? "s" : ""}) — données indicatives.
          </div>
        )}

        <div className="mx-auto max-w-4xl space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Total leads" value={stats.totalLeads} />
            <KpiCard label="Convertis" value={stats.convertedCount} />
            <KpiCard label="Taux conversion" value={pct(stats.conversionRate)} />
            <KpiCard label="Délai moyen" value={daysLabel(stats.avgDaysToConvert)} />
            <KpiCard label="Délai médian" value={daysLabel(stats.medianDaysToConvert)} />
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Pipeline ouvert</p>
              <p className="mt-1 text-lg font-semibold text-foreground font-heading">
                {stats.openCount} lead{stats.openCount > 1 ? "s" : ""}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                âge moy. {daysLabel(stats.avgAgeOpenLeads)} · {stats.stalledCount} en stagnation (&gt;{STALL_DAYS}j)
              </p>
            </div>
          </div>

          {/* Funnel */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Entonnoir
            </h2>
            {funnel.type === "by_stage" ? (
              <div className="space-y-2">
                {funnel.stages.map((s, i) => {
                  const maxCount = Math.max(...funnel.stages.map((x) => x.currentCount), 1);
                  const pctWidth = (s.currentCount / maxCount) * 100;
                  return (
                    <div key={s.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {s.name}
                          {s.kind === "converted" && (
                            <span className="ml-1.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600">converti</span>
                          )}
                          {s.kind === "lost" && (
                            <span className="ml-1.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600">perdu</span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {s.currentCount} lead{s.currentCount > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="relative h-4 w-full rounded-md bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-md transition-all",
                            s.kind === "converted" ? "bg-emerald-500" : s.kind === "lost" ? "bg-red-400" : "bg-primary"
                          )}
                          style={{ width: `${pctWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Nouveaux" value={funnel.new} />
                <KpiCard label="En cours" value={funnel.in_progress} />
                <KpiCard label="Convertis" value={funnel.converted} />
                <KpiCard label="Perdus" value={funnel.lost} />
              </div>
            )}
          </section>

          {/* Par source */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Taux de conversion par source
            </h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <Th>Source</Th>
                    <Th className="text-right">Leads</Th>
                    <Th className="text-right">Convertis</Th>
                    <Th className="text-right">Taux</Th>
                    <Th className="pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {bySource.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Aucune donnée</td></tr>
                  ) : bySource.map((row) => {
                    const maxTotal = Math.max(...bySource.map((r) => r.total), 1);
                    return (
                      <tr key={row.source} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">{row.source}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{row.total}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{row.converted}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{pct(row.rate)}</td>
                        <td className="pr-4">
                          <div className="h-2 w-full rounded bg-muted">
                            <div
                              className="h-full rounded bg-primary"
                              style={{ width: `${(row.total / maxTotal) * 100}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Par température */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Chaud vs Froid
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-1 text-xs text-muted-foreground">🔥 Chaud</p>
                <p className="text-2xl font-semibold text-foreground">{pct(byTemp.hot.rate)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {byTemp.hot.converted} / {byTemp.hot.total} leads
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-1 text-xs text-muted-foreground">❄️ Froid</p>
                <p className="text-2xl font-semibold text-foreground">{pct(byTemp.cold.rate)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {byTemp.cold.converted} / {byTemp.cold.total} leads
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground font-heading">{value}</p>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-left text-xs font-medium text-muted-foreground", className)}>{children}</th>;
}
