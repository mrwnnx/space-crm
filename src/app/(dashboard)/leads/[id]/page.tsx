import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadById, getLeadStatuses, getLeadSources, getEmailTemplates, getScheduleForLead, getTags, getTagIdsForLead } from "@/lib/queries";
import { cn, statusColor, initials, formatDate, formatRelative } from "@/lib/utils";
import { LeadDetailHeader } from "@/components/leads/lead-detail-header";
import { LeadSidePanel } from "@/components/leads/lead-side-panel";
import { LeadTags } from "@/components/leads/lead-tags";
import { MarkLeadSeen } from "@/components/leads/mark-lead-seen";
import { PaymentBlock } from "@/components/leads/payment-block";
import { ActivityPanel } from "@/components/activities/activity-panel";
import { LinkedTasks } from "@/components/tasks/linked-tasks";
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

  const [statuses, sources, templates, allTags, leadTagIds] = await Promise.all([
    getLeadStatuses(),
    getLeadSources(),
    getEmailTemplates(),
    getTags(),
    getTagIdsForLead(id),
  ]);

  const schedule = lead.converted ? await getScheduleForLead(lead.id) : null;

  const sc = lead.status ? statusColor(lead.status.color) : null;

  return (
    <>
      <MarkLeadSeen leadId={lead.id} />

      <LeadDetailHeader
        leadId={lead.id}
        fullName={lead.fullName}
        statusId={lead.statusId}
        statuses={statuses}
        converted={lead.converted}
        statusColor={sc}
        statusName={lead.status?.name}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Main: Activity panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ActivityPanel
            referenceType="lead"
            referenceId={lead.id}
            activities={lead.activities.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
            comments={lead.comments.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
            }))}
            leadEmail={lead.email}
            leadMobile={lead.mobileNo}
            leadWhatsapp={lead.contact?.whatsapp ?? lead.mobileNo}
            templates={templates}
          />
        </div>

        {/* Panneau infos — à GAUCHE sur desktop.
            `lg:order-first` plutôt qu'un déplacement dans le DOM : sur mobile
            (colonne unique) l'activité reste en premier et les infos en dessous,
            comme avant. La bordure passe de gauche à droite puisque le panneau
            change de côté. */}
        <div className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-border bg-card lg:order-first lg:w-80 lg:border-r lg:border-t-0">
          <div className="flex items-center gap-3 border-b border-border p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {initials(lead.fullName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {lead.fullName}
              </p>
              {lead.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {lead.email}
                </p>
              )}
            </div>
          </div>

          <div className="border-b border-border p-4">
            <LeadTags leadId={lead.id} allTags={allTags} tagIds={leadTagIds} />
          </div>

          <LeadSidePanel
            leadId={lead.id}
            lead={{
              email: lead.email,
              mobileNo: lead.mobileNo,
              sourceId: lead.sourceId,
              intendedPlan: lead.intendedPlan,
              promoCode: lead.promoCode,
            }}
            contactId={lead.contactId}
            contact={{
              whatsapp: lead.contact?.whatsapp ?? null,
              age: lead.contact?.age ?? null,
              unsubscribedAt: lead.contact?.unsubscribedAt ?? null,
              bouncedAt: lead.contact?.bouncedAt ?? null,
              bounceReason: lead.contact?.bounceReason ?? null,
            }}
            sources={sources}
            bootcamp={lead.bootcamp}
          />

          {schedule && (
            <PaymentBlock
              leadId={lead.id}
              items={schedule.items.map((e) => ({
                id: e.id,
                dueDate: e.dueDate,
                amount: e.amount,
                isPaid: e.isPaid,
                paidAt: e.paidAt,
              }))}
              summary={schedule.summary}
              currency={lead.bootcamp?.currency}
            />
          )}

          <LinkedTasks
            tasks={lead.tasks}
            referenceType="lead"
            referenceId={lead.id}
          />

          <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground">
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
