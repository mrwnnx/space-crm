import { notFound } from "next/navigation";
import Link from "next/link";
import { getLeadById, getLeadStatuses, getLeadSources, getEmailTemplates, getScheduleForLead, getTags, getTagIdsForLead, getCallLogsByReference } from "@/lib/queries";
import {
  getLeadTimeline,
  getInsightForLead,
  getEngagementForLead,
  getMultiFormByBootcamp,
} from "@/lib/queries";
import { recommend } from "@/lib/lead-recommendation";
import { LeadTabs } from "@/components/leads/lead-tabs";
import { cn, statusColor, initials, formatDate, formatRelative } from "@/lib/utils";
import { LeadDetailHeader } from "@/components/leads/lead-detail-header";
import { LeadSidePanel } from "@/components/leads/lead-side-panel";
import { LeadTags } from "@/components/leads/lead-tags";
import { MarkLeadSeen } from "@/components/leads/mark-lead-seen";
import { DuplicateBanner } from "@/components/leads/duplicate-banner";
import { getDuplicateInfo } from "@/lib/duplicates";
import { getReturningForLead, getCarriedOrigin } from "@/lib/queries";
import { PaymentBlock } from "@/components/leads/payment-block";
import { CallHistory } from "@/components/leads/call-history";
import { ActivityPanel } from "@/components/activities/activity-panel";
import { LinkedTasks } from "@/components/tasks/linked-tasks";
import { LeadCampaignHistory } from "@/components/campaigns/lead-campaign-history";
import { getCampaignsForContact } from "@/lib/campaigns/analytics";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const lead = await getLeadById(id);

  if (!lead) notFound();

  // D'où l'on vient. `?from=<bootcampId>` est posé par les cartes du kanban ;
  // on ne le suit que s'il désigne bien la formation de ce lead, pour ne pas
  // renvoyer vers une pipeline qui ne le contient pas.
  const back =
    from && lead.bootcamp && from === lead.bootcamp.id
      ? { href: `/bootcamps/${lead.bootcamp.id}`, label: lead.bootcamp.name }
      : { href: "/leads", label: "Leads" };

  const [statuses, sources, templates, allTags, leadTagIds] = await Promise.all([
    getLeadStatuses(),
    getLeadSources(),
    getEmailTemplates(),
    getTags(),
    getTagIdsForLead(id),
  ]);

  const schedule = lead.converted ? await getScheduleForLead(lead.id) : null;
  const duplicateInfo = await getDuplicateInfo(lead.id);
  const returning = await getReturningForLead(lead.id);
  const carriedFrom = await getCarriedOrigin(lead.id);
  const callLogs = await getCallLogsByReference("lead", lead.id);
  const campaignHistory = lead.contactId
    ? await getCampaignsForContact(lead.contactId)
    : [];

  const sc = lead.status ? statusColor(lead.status.color) : null;

  // Les changements de statut écrits AVANT ce correctif contiennent
  // l'identifiant interne de la colonne (« Nouveau statut: 6d674394-963f-… »).
  // On le remplace par son nom à l'affichage — réécrire les lignes en base
  // laisserait tomber celles dont la colonne a depuis été supprimée.
  const statusNames = new Map(statuses.map((s) => [s.id, s.name]));
  const readable = (a: { type: string; content: string | null }) =>
    a.type === "status_change" && a.content
      ? a.content.replace(UUID_RE, (id) => statusNames.get(id) ?? id)
      : a.content;

  // ── Ce qui alimente les onglets « Score » et « Activité ».
  const [insight, engagement, multiSet, timeline] = await Promise.all([
    getInsightForLead(lead.id),
    getEngagementForLead(lead.id),
    // Restreint à CE lead : sans le 3e argument, la fiche scannait le
    // raw_payload des 191 autres pour répondre par oui ou non.
    lead.bootcampId
      ? getMultiFormByBootcamp(lead.bootcampId, lead.id)
      : Promise.resolve(new Set<string>()),
    getLeadTimeline(lead.id),
  ]);

  const lastCall = callLogs[0] ?? null;
  const reco = recommend({
    converted: lead.status?.kind === "converted",
    lost: lead.status?.kind === "lost",
    qualification: lead.qualification,
    nextFollowUpAt: lead.nextFollowUpAt,
    clicked: engagement?.clicked ?? false,
    clickedVideo: engagement?.video ?? false,
    wantsCall: lead.wantsCall ?? false,
    multiForm: multiSet.has(lead.id),
    lastCallAt: lastCall?.createdAt ?? null,
    lastCallStatus: lastCall?.status ?? null,
    objection: insight?.objection ?? null,
    stageDays: Math.floor(
      (Date.now() - new Date(lead.stageEnteredAt ?? lead.createdAt).getTime()) / 86400000
    ),
    unsubscribed: !!lead.contact?.unsubscribedAt,
    bounced: !!lead.contact?.bouncedAt,
    hasPhone: !!lead.mobileNo,
  });

  return (
    <>
      <MarkLeadSeen leadId={lead.id} />

      <LeadDetailHeader
        leadId={lead.id}
        backHref={back.href}
        backLabel={back.label}
        fullName={lead.fullName}
        statusId={lead.statusId}
        statuses={statuses}
        converted={lead.converted}
        statusColor={sc}
        statusName={lead.status?.name}
      />

      {/* Mobile : une seule colonne qui défile normalement. Le découpage en
          deux panneaux à hauteur fixe ne commence qu'à `lg` — sur téléphone il
          écrasait la zone des onglets à zéro et bloquait le défilement, rendant
          la fiche inutilisable (constaté le 2026-09-09). */}
      <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Main: 3 lectures du lead — agir, décider, comprendre. */}
        <LeadTabs
          insight={insight}
          recommendation={reco}
          timeline={timeline}
          exchanges={
          <ActivityPanel
            referenceType="lead"
            referenceId={lead.id}
            activities={lead.activities.map((a) => ({
              ...a,
              content: readable(a),
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
          }
        />

        {/* Panneau infos — à GAUCHE sur desktop.
            `lg:order-first` plutôt qu'un déplacement dans le DOM : sur mobile
            (colonne unique) l'activité reste en premier et les infos en dessous,
            comme avant. La bordure passe de gauche à droite puisque le panneau
            change de côté. */}
        <div className="flex w-full flex-col border-t border-border bg-card lg:order-first lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-t-0">
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

          {duplicateInfo && (
            <DuplicateBanner leadId={lead.id} info={duplicateInfo} />
          )}

          {carriedFrom && (
            // Le message que Marwen voulait : « ces gens-là, tu les as déjà
            // contactés, mais rien n'a été conclu ».
            <div className="border-b border-border bg-amber-50 px-4 py-2.5">
              <p className="text-xs font-medium text-amber-900">
                ↪ Reporté de « {carriedFrom.bootcamp_name} » — déjà contacté, jamais conclu
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {carriedFrom.qualification
                  ? `Dernière qualification : ${carriedFrom.qualification} · `
                  : ""}
                <a href={`/leads/${carriedFrom.origin_id}`} className="underline">
                  voir la fiche d&apos;origine
                </a>
              </p>
            </div>
          )}

          {returning && (
            // Déjà inscrit ailleurs = ancien élève. Déjà passé sans s'inscrire =
            // intérêt répété. Les deux changent la façon d'aborder l'appel.
            <div
              className={
                returning.alumni
                  ? "border-b border-border bg-violet-50 px-4 py-2.5"
                  : "border-b border-border bg-sky-50 px-4 py-2.5"
              }
            >
              <p
                className={
                  returning.alumni
                    ? "text-xs font-medium text-violet-900"
                    : "text-xs font-medium text-sky-900"
                }
              >
                {returning.alumni
                  ? "★ Ancien inscrit — cette personne s'est déjà inscrite chez vous"
                  : "↺ Déjà venu — cette personne a déjà été un lead sur une autre formation"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {returning.formations.join(" · ")}
              </p>
            </div>
          )}

          <div className="border-b border-border p-4">
            <LeadTags leadId={lead.id} allTags={allTags} tagIds={leadTagIds} />
          </div>

          <LeadSidePanel
            leadId={lead.id}
            // L'échéancier remonte jusqu'ici : c'est dans le panneau « Offre »
            // qu'on vient renégocier, pas dans le bloc Paiement — lequel
            // n'existe que pour les 2 leads inscrits sur 283.
            schedule={
              schedule
                ? {
                    total: schedule.items.reduce((n, e) => n + Number(e.amount ?? 0), 0),
                    paid: schedule.items
                      .filter((e) => e.isPaid)
                      .reduce((n, e) => n + Number(e.amount ?? 0), 0),
                  }
                : null
            }
            lead={{
              email: lead.email,
              mobileNo: lead.mobileNo,
              sourceId: lead.sourceId,
              intendedPlan: lead.intendedPlan,
              offerTotal: lead.offerTotal,
              offerMonthlyCount: lead.offerMonthlyCount,
              offerMonthlyAmount: lead.offerMonthlyAmount,
              promoCode: lead.promoCode,
              motivation: lead.motivation,
              wantsCall: lead.wantsCall,
              qualification: lead.qualification,
              nextFollowUpAt: lead.nextFollowUpAt,
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

          <CallHistory
            logs={callLogs.map((c) => ({
              id: c.id,
              status: c.status,
              duration: c.duration,
              callerId: c.callerId,
              createdAt: c.createdAt,
            }))}
          />

          <LeadCampaignHistory rows={campaignHistory} />

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
