import { notFound } from "next/navigation";
import Link from "next/link";
import { getCampaignById, getCampaignRecipients } from "@/lib/campaigns/queries";
import { getCampaignStats, getLinkClicks } from "@/lib/campaigns/analytics";
import { resolveCampaignAudience } from "@/lib/campaigns/audience";
import { renderCampaignHtml } from "@/lib/campaigns/template";
import { checkCampaign } from "@/lib/campaigns/preflight";
import { getTagsWithUsage } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { CampaignSend } from "@/components/campaigns/campaign-send";
import { CampaignPublish } from "@/components/campaigns/campaign-publish";
import { CampaignStepper } from "@/components/campaigns/campaign-stepper";
import { CampaignStatsPanel } from "@/components/campaigns/campaign-stats";
import { CampaignStatusActions } from "@/components/campaigns/campaign-status-actions";
import { CampaignAudienceList } from "@/components/campaigns/campaign-audience-list";
import { CampaignLinks } from "@/components/campaigns/campaign-links";
import { STATUS_LABEL } from "@/components/campaigns/status-labels";

export const dynamic = "force-dynamic";

/** Une campagne partie se LIT ; un brouillon se TRAVAILLE. Deux écrans. */
const REPORT_STATUSES = ["sending", "sent", "failed"];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Enveloppe commune aux deux modes. Déclarée AU MODULE : un composant créé
 *  pendant le rendu serait recréé à chaque passage et perdrait son état. */
function Shell({
  campaign,
  children,
}: {
  campaign: { id: string; name: string; subject: string | null; status: string };
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title={campaign.name} subtitle={campaign.subject || "Sans sujet"} />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/campaigns"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Toutes les campagnes
            </Link>
            <CampaignStatusActions campaignId={campaign.id} status={campaign.status} />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etape?: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const isReport = REPORT_STATUSES.includes(campaign.status);
  const badge = STATUS_LABEL[campaign.status] ?? {
    text: campaign.status,
    className: "bg-muted text-muted-foreground",
  };

  // ── Mode RAPPORT ─────────────────────────────────────
  if (isReport) {
    const [recipients, stats, links] = await Promise.all([
      getCampaignRecipients(campaign.id),
      getCampaignStats(campaign.id),
      getLinkClicks(campaign.id),
    ]);

    const preview = renderCampaignHtml({
      content: campaign.content || "<p></p>",
      unsubscribeUrl: "#apercu",
    });

    return (
      <Shell campaign={campaign}>
        <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border px-4 py-3 text-xs text-muted-foreground">
              <span className={`rounded-md px-2 py-0.5 font-medium ${badge.className}`}>
                {badge.text}
              </span>
              {campaign.sentAt && <span>Envoyée le {formatDate(campaign.sentAt)}</span>}
              <span>{recipients.length} destinataire{recipients.length > 1 ? "s" : ""}</span>
            </div>

            <Section title="Performance de la campagne">
              <CampaignStatsPanel stats={stats} />
            </Section>

            {campaign.status === "sending" && (
              <Section title="Envoi">
                <CampaignSend
                  campaignId={campaign.id}
                  status={campaign.status}
                  recipients={recipients}
                  canSend={false}
                />
              </Section>
            )}

            {links.length > 0 && (
              <Section title="Liens cliqués">
                <CampaignLinks links={links} />
              </Section>
            )}

            <Section title={`Audience (${recipients.length})`}>
              <CampaignAudienceList rows={recipients} />
            </Section>

            <Section title="Contenu envoyé">
              {/* Replié : il compte, mais il n'a plus à occuper l'écran. */}
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">
                  Voir l&apos;email tel qu&apos;il a été envoyé
                </summary>
                <iframe
                  title="Contenu envoyé"
                  srcDoc={preview}
                  sandbox=""
                  className="h-[480px] w-full border-t border-border bg-white"
                />
              </details>
          </Section>
        </div>
      </Shell>
    );
  }

  // ── Mode PRÉPARATION — deux étapes, comme Kit ────────
  // On écrit d'abord, on décide ensuite à qui et quand. L'étape vit dans
  // l'URL : un rechargement ne renvoie pas au début.
  const { etape } = await searchParams;
  const step = etape === "envoyer" ? "envoyer" : "rediger";

  const tags = await getTagsWithUsage();
  const recipients = await getCampaignRecipients(campaign.id);
  const { stats: audience } = await resolveCampaignAudience({
    tagIds: (campaign.targetTagIds as string[]) ?? [],
    emails: (campaign.targetEmails as string[]) ?? [],
  });
  const canSend =
    !!campaign.subject?.trim() && !!campaign.content?.trim() && audience.total > 0;

  // Mêmes contrôles qu'à l'écran d'écriture et qu'à l'envoi : un seul module.
  const blocking = checkCampaign({
    subject: campaign.subject ?? "",
    content: campaign.content ?? "",
  })
    .filter((c) => c.level === "error")
    .map((c) => c.message);

  const preview = renderCampaignHtml({
    content: campaign.content || "<p></p>",
    unsubscribeUrl: "#apercu",
  });

  return (
    <Shell campaign={campaign}>
      <div className="mb-6 border-b border-border pb-3">
        <CampaignStepper
          campaignId={campaign.id}
          step={step}
          subject={campaign.subject ?? ""}
          content={campaign.content ?? ""}
        />
      </div>

      {step === "rediger" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Contenu">
            <CampaignEditor
              campaignId={campaign.id}
              initialSubject={campaign.subject ?? ""}
              initialContent={campaign.content}
              readOnly={campaign.status !== "draft"}
            />
          </Section>

          <Section title="Aperçu dans la boîte de réception">
            <iframe
              title="Aperçu de l'email"
              srcDoc={preview}
              sandbox=""
              className="h-[560px] w-full rounded-lg border border-border bg-white"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Le lien de désabonnement est inactif ici&nbsp;; à l&apos;envoi,
              chaque destinataire reçoit le sien.
            </p>
          </Section>
        </div>
      ) : (
        <CampaignPublish
          campaignId={campaign.id}
          status={campaign.status}
          tags={tags}
          initialTagIds={(campaign.targetTagIds as string[]) ?? []}
          initialEmails={(campaign.targetEmails as string[]) ?? []}
          initialNote={campaign.internalNote ?? ""}
          recipients={recipients}
          recipientCount={audience.total}
          canSend={canSend}
          blocking={blocking}
          from={process.env.EMAIL_FROM ?? "Expéditeur non configuré"}
        />
      )}
    </Shell>
  );
}
