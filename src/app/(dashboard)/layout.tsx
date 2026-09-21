import { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { WhatsAppNotifier } from "@/components/whatsapp/notifier";
import { TeamProfilesProvider } from "@/components/team-profiles";
import { getTeamProfiles } from "@/lib/profiles";
import { currentActor } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Les noms et photos de l'équipe, une fois pour tout l'écran : chaque auteur
  // affiché (fil, kanban, échéancier, WhatsApp) les lit depuis ce contexte.
  const [profiles, me] = await Promise.all([getTeamProfiles(), currentActor()]);

  return (
    <TeamProfilesProvider profiles={profiles} me={me}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden pt-12 lg:pt-0">
          {children}
        </main>
        {/* Disponible sur tous les écrans du CRM, jamais dans le chemin. */}
        <AssistantPanel />
        {/* Le « bip » d'un WhatsApp reçu, où qu'on soit dans le CRM. */}
        <WhatsAppNotifier />
      </div>
    </TeamProfilesProvider>
  );
}
