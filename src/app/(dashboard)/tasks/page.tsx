import Link from "next/link";
import { getTasks } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { ViewToggle } from "@/components/view-toggle";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TasksScopeToggle } from "@/components/tasks/tasks-scope-toggle";
import { currentActor } from "@/lib/auth";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/db/schema";

export const dynamic = "force-dynamic";

const PRIORITY_CONFIG: Record<string, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-red-50 text-red-700" },
  medium: { label: "Medium", classes: "bg-amber-50 text-amber-700" },
  low: { label: "Low", classes: "bg-gray-50 text-gray-600" },
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; mine?: string }>;
}) {
  const { view, mine } = await searchParams;
  const isList = view === "list";
  // « Mes tâches » = celles assignées à l'adresse du compte connecté.
  const actor = await currentActor();
  const onlyMine = mine === "1";
  // Le garde de src/proxy.ts assure une session ; si l'adresse manquait quand
  // même, « Mes tâches » doit ne RIEN montrer, pas tout montrer.
  const tasks =
    onlyMine && !actor ? [] : await getTasks(onlyMine ? actor! : undefined);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <TasksScopeToggle mine={onlyMine} />
            <ViewToggle current={isList ? "list" : "kanban"} />
            <NewTaskButton />
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        {isList ? (
          <TasksList tasks={tasks} onlyMine={onlyMine} actor={actor} />
        ) : (
          <TasksBoard tasks={tasks} />
        )}
      </div>
    </>
  );
}

function TasksList({
  tasks,
  onlyMine,
  actor,
}: {
  tasks: Task[];
  onlyMine: boolean;
  actor: string | null;
}) {
  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
        <p className="text-sm font-medium text-foreground">
          {onlyMine ? "Aucune tâche pour toi" : "Aucune tâche"}
        </p>
        {/* Le message générique « créez votre première tâche » mentirait ici :
            il en existe peut-être, simplement assignées à quelqu'un d'autre. */}
        <p className="text-xs text-muted-foreground">
          {onlyMine
            ? `Rien n'est assigné à ${actor ?? "ce compte"}.`
            : "Créez votre première tâche pour commencer."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <th className="px-3 py-2.5 pl-5 text-left text-xs font-medium text-muted-foreground">Title</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Priority</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Assigné</th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Échéance</th>
            <th className="px-3 py-2.5 pr-5 text-right text-xs font-medium text-muted-foreground">Créé</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const pr = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
            return (
              <tr
                key={task.id}
                className="group border-b border-border transition-colors hover:bg-muted/40"
              >
                <td className="py-2.5 pl-5">
                  <span className="text-sm font-medium text-foreground group-hover:text-primary">
                    {task.title}
                  </span>
                  {task.referenceType && task.referenceId && (
                    <Link
                      href={refHref(task.referenceType, task.referenceId)}
                      className="ml-2 text-xs text-primary hover:text-primary/80"
                    >
                      {task.referenceType} →
                    </Link>
                  )}
                </td>
                <td>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pr.classes)}>
                    {pr.label}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {task.assignedTo || "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {task.dueDate ? formatDate(task.dueDate) : "—"}
                  </span>
                </td>
                <td className="pr-5 text-right">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(task.createdAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function refHref(type: string, id: string): string {
  const map: Record<string, string> = {
    lead: "leads",
    deal: "deals",
    contact: "contacts",
    organization: "organizations",
  };
  return `/${map[type] || type + "s"}/${id}`;
}
