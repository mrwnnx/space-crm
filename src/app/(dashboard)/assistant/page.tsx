import { PageHeader } from "@/components/page-header";
import { AssistantConversation } from "@/components/assistant/assistant-conversation";

export const dynamic = "force-dynamic";

/**
 * L'assistant en grand.
 *
 * Même conversation que le panneau — elle vit en base, par utilisateur. Le
 * panneau sert quand on est sur une fiche ; cette page sert le matin, quand on
 * ouvre sa journée et qu'on veut de la place pour lire une liste d'appels.
 */
export default function AssistantPage() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="Assistant" subtitle="Il lit le CRM. Il ne modifie encore rien." />
      <AssistantConversation large />
    </div>
  );
}
