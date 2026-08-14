import { notFound } from "next/navigation";
import Link from "next/link";
import { getCampaignById, getCampaignRecipients } from "@/lib/campaigns/queries";
import { renderCampaignHtml } from "@/lib/campaigns/template";
import { PageHeader } from "@/components/page-header";
import { CampaignEditor } from "@/components/campaigns/campaign-editor";
import { CampaignAudience } from "@/components/campaigns/campaign-audience";
import { CampaignSend } from "@/components/campaigns/campaign-send";
import { resolveCampaignAudience } from "@/lib/campaigns/audience";
import { getTagsWithUsage } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaignById(id);
  if (!campaign) notFound();

  const tags = await getTagsWithUsage();
  const recipients = await getCampaignRecipients(campaign.id);

  // Le bouton d'envoi n'est actif que si la campagne est réellement envoyable.
  const { stats } = await resolveCampaignAudience({
    tagIds: (campaign.targetTagIds as string[]) ?? [],
    emails: (campaign.targetEmails as string[]) ?? [],
  });
  const canSend =
    !!campaign.subject?.trim() && !!campaign.content?.trim() && stats.total > 0;

  const readOnly = campaign.status !== "draft";

  // Aperçu avec un token factice : ce que verra le destinataire, pied de page
  // de désinscription compris — c'est là qu'on voit s'il manque.
  const preview = renderCampaignHtml({
    content: campaign.content || "<p></p>",
    unsubscribeUrl: "#apercu",
  });

  return (
    <>
      <PageHeader
        title={campaign.name}
        subtitle={readOnly ? "Campagne envoyée — lecture seule" : "Brouillon"}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/campaigns"
            className="mb-4 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            ← Toutes les campagnes
          </Link>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cible
                </h2>
                <CampaignAudience
                  campaignId={campaign.id}
                  tags={tags}
                  initialTagIds={(campaign.targetTagIds as string[]) ?? []}
                  initialEmails={(campaign.targetEmails as string[]) ?? []}
                  readOnly={readOnly}
                />
              </div>

              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contenu
              </h2>
              <CampaignEditor
                campaignId={campaign.id}
                initialSubject={campaign.subject ?? ""}
                initialContent={campaign.content}
                readOnly={readOnly}
              />
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Envoi
                </h2>
                <CampaignSend
                  campaignId={campaign.id}
                  status={campaign.status}
                  recipients={recipients}
                  canSend={canSend}
                />
              </div>

              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Aperçu dans la boîte de réception
              </h2>
              <iframe
                title="Aperçu de l'email"
                srcDoc={preview}
                // sandbox sans allow-scripts : l'aperçu ne doit jamais exécuter
                // de code, même si un contenu douteux se retrouvait en base.
                sandbox=""
                className="h-[520px] w-full rounded-lg border border-border bg-white"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Le lien de désabonnement est inactif ici ; à l&apos;envoi, chaque
                destinataire reçoit le sien.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
