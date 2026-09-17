import { PageHeader } from "@/components/page-header";
import { WhatsAppInbox } from "@/components/whatsapp/inbox";
import { fenetreOuverte, getQuickReplies, getWhatsAppConversations, getWhatsAppThread } from "@/lib/whatsapp-inbox";
import { listWhatsAppTemplates } from "@/lib/messaging/whatsapp";
import { getBootcamps } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * La boîte WhatsApp de l'école — la seule, puisque le numéro est sur l'API et
 * plus sur un téléphone. Une conversation par lead ; `?lead=` ouvre la sienne.
 */
export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; q?: string; archives?: string }>;
}) {
  const { lead: leadId, q, archives } = await searchParams;
  const [conversations, thread, templates, bootcamps, quickReplies] = await Promise.all([
    getWhatsAppConversations(q),
    leadId ? getWhatsAppThread(leadId) : Promise.resolve(null),
    // Seuls les modèles approuvés s'envoient ; les autres attendent chez Meta.
    listWhatsAppTemplates().then((t) => t.filter((x) => x.status === "APPROVED")),
    // Pour donner une formation à un lead né d'un message WhatsApp.
    getBootcamps(),
    getQuickReplies(),
  ]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader
        title="WhatsApp"
        subtitle="Les messages reçus sur le numéro de l'école, et vos réponses."
      />
      <WhatsAppInbox
        conversations={conversations.map((c) => ({
          ...c,
          lastAt: c.lastAt.toISOString(),
          lastInboundAt: c.lastInboundAt?.toISOString() ?? null,
        }))}
        q={q ?? ""}
        archives={archives === "1"}
        thread={
          thread
            ? {
                archived: thread.archived,
                lead: thread.lead,
                messages: thread.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
                lastInboundAt: thread.lastInboundAt?.toISOString() ?? null,
                ouverte: fenetreOuverte(thread.lastInboundAt),
              }
            : null
        }
        templates={templates}
        bootcamps={bootcamps.map((b) => ({ id: b.id, name: b.name }))}
        quickReplies={quickReplies.map((q) => ({ shortcut: q.shortcut, text: q.text }))}
      />
    </div>
  );
}
