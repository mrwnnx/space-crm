import { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { AssistantPanel } from "@/components/assistant/assistant-panel";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden pt-12 lg:pt-0">
        {children}
      </main>
      {/* Disponible sur tous les écrans du CRM, jamais dans le chemin. */}
      <AssistantPanel />
    </div>
  );
}
