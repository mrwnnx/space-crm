import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadById, getLeadStatuses, getLeadSources, getIndustries } from "@/lib/queries";
import { cn, statusColor, initials, formatDate, formatRelative } from "@/lib/utils";
import { LeadDetailHeader } from "@/components/leads/lead-detail-header";
import { LeadSidePanel } from "@/components/leads/lead-side-panel";
import { LeadActivities } from "@/components/leads/lead-activities";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLeadById(id);
  return { title: lead ? `${lead.fullName} — Academy CRM` : "Lead" };
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadById(id);

  if (!lead) notFound();

  const [statuses, sources, industries] = await Promise.all([
    getLeadStatuses(),
    getLeadSources(),
    getIndustries(),
  ]);

  const sc = lead.status ? statusColor(lead.status.color) : null;

  return (
    <>
      <LeadDetailHeader
        leadId={lead.id}
        fullName={lead.fullName}
        statusId={lead.statusId}
        statuses={statuses}
        converted={lead.converted}
        statusColor={sc}
        statusName={lead.status?.name}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main: Activities */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <LeadActivities
            leadId={lead.id}
            activities={lead.activities.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        </div>

        {/* Side panel: Lead info */}
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {initials(lead.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {lead.fullName}
              </p>
              {lead.jobTitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {lead.jobTitle}
                </p>
              )}
            </div>
          </div>

          <LeadSidePanel
            leadId={lead.id}
            lead={{
              email: lead.email,
              mobileNo: lead.mobileNo,
              phone: lead.phone,
              website: lead.website,
              jobTitle: lead.jobTitle,
              organizationName: lead.organizationName,
              sourceId: lead.sourceId,
              industryId: lead.industryId,
            }}
            sources={sources}
            industries={industries}
          />

          <div className="border-t border-border p-4 text-xs text-muted-foreground">
            <div className="flex justify-between py-1">
              <span>Créé le</span>
              <span className="font-medium text-foreground">
                {formatDate(lead.createdAt)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Dernier contact</span>
              <span className="font-medium text-foreground">
                {formatRelative(lead.lastContactedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
