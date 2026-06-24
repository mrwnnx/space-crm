import { db } from "@/db";
import { sequences } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getStaleLeads } from "@/lib/scoring-server";
import { SequenceManager } from "@/components/sequences/sequence-manager";
import { StaleLeadsList } from "@/components/sequences/stale-leads-list";

export const dynamic = "force-dynamic";

export default async function SequencesPage() {
  const [allSequences, staleLeads] = await Promise.all([
    db.query.sequences.findMany({
      with: { steps: true },
      orderBy: [desc(sequences.createdAt)],
    }),
    getStaleLeads(30),
  ]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Séquences</h1>
          <p className="text-xs text-slate-500">
            Relance automatisée des leads froids
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5">
          <span className="text-xs text-slate-500">Cron:</span>
          <code className="text-[10px] text-slate-400">
            /api/cron/sequences?secret=***
          </code>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
        {/* ── Stale leads to re-engage ─────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-700">
            Leads à relancer ({staleLeads.length})
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            Pas de contact depuis 30+ jours, toujours actifs
          </p>
          <StaleLeadsList leads={staleLeads} sequences={allSequences} />
        </div>

        {/* ── Sequences ────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Séquences ({allSequences.length})
          </h2>
          <SequenceManager sequences={allSequences} />
        </div>
      </div>
    </div>
  );
}
