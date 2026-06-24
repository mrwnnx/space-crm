import { notFound } from "next/navigation";
import { getLeadById } from "@/lib/queries";
import { getScoreTier, TIER_CONFIG } from "@/lib/scoring";
import { cn, formatDate, formatRelative, initials } from "@/lib/utils";
import { LeadActions } from "@/components/leads/lead-actions";
import { ActivityFeed } from "@/components/leads/activity-feed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) notFound();

  const tier = getScoreTier(lead.score);
  const tierConfig = TIER_CONFIG[tier];

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
        <Link
          href="/pipeline"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Pipeline
        </Link>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
              tierConfig.bg,
              tierConfig.color
            )}
          >
            {initials(lead.fullName)}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              {lead.fullName}
            </h1>
            <p className="text-xs text-slate-500">
              {lead.stage?.name} · Score {lead.score} ({tierConfig.label})
            </p>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-3">
        {/* ── Left: Lead info + Actions ───────────── */}
        <div className="space-y-6 overflow-y-auto">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">
              Coordonnées
            </h2>
            <dl className="space-y-3 text-sm">
              <InfoRow label="Email" value={lead.email} />
              <InfoRow label="Téléphone" value={lead.phone} />
              <InfoRow label="WhatsApp" value={lead.whatsapp} />
              <InfoRow label="Source" value={lead.source} />
              <InfoRow
                label="Cohort"
                value={lead.cohortInterest?.name}
              />
              <InfoRow
                label="Créé le"
                value={formatDate(lead.createdAt)}
              />
              <InfoRow
                label="Dernier contact"
                value={formatRelative(lead.lastContactedAt)}
              />
            </dl>
            {lead.notes && (
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Notes</p>
                <p className="mt-1 text-sm text-slate-700">{lead.notes}</p>
              </div>
            )}
            {lead.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <LeadActions leadId={lead.id} />
        </div>

        {/* ── Right: Activity timeline ────────────── */}
        <div className="lg:col-span-2">
          <ActivityFeed
            leadId={lead.id}
            activities={lead.activities.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}
