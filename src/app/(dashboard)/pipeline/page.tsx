import { getStagesWithLeads } from "@/lib/queries";
import { KanbanBoard } from "@/components/kanban/kanban-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const stages = await getStagesWithLeads();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Pipeline</h1>
          <p className="text-xs text-slate-500">
            {stages.reduce((sum, s) => sum + s.leads.length, 0)} leads au total
          </p>
        </div>
      </header>

      <KanbanBoard stages={stages} />
    </div>
  );
}
