import Link from "next/link";
import { getTasks } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/db/schema";

export const dynamic = "force-dynamic";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  canceled: "Canceled",
};

export default async function CalendarPage() {
  const tasks = await getTasks();
  const tasksWithDates = tasks.filter((t) => t.dueDate);

  // Group by day
  const byDay = new Map<string, Task[]>();
  for (const task of tasksWithDates) {
    const dateKey = new Date(task.dueDate!).toISOString().slice(0, 10);
    if (!byDay.has(dateKey)) byDay.set(dateKey, []);
    byDay.get(dateKey)!.push(task);
  }

  // Sort days
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Generate current month calendar grid
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday-first

  const todayStr = now.toISOString().slice(0, 10);
  const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-4xl">
          {/* Month grid */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-7 gap-1">
              {weekdays.map((wd) => (
                <div key={wd} className="pb-2 text-center text-xs font-medium text-muted-foreground">
                  {wd}
                </div>
              ))}
              {Array.from({ length: startWeekday }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
                const dayTasks = byDay.get(dateStr) || [];
                const isToday = dateStr === todayStr;
                return (
                  <div
                    key={day}
                    className={cn(
                      "min-h-16 rounded-lg border p-1.5",
                      isToday ? "border-primary bg-primary/5" : "border-border"
                    )}
                  >
                    <span className={cn(
                      "text-xs",
                      isToday ? "font-bold text-primary" : "text-muted-foreground"
                    )}>
                      {day}
                    </span>
                    {dayTasks.slice(0, 2).map((task) => (
                      <div
                        key={task.id}
                        className="mt-1 flex items-center gap-1 truncate text-[10px]"
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium)} />
                        <span className={cn(
                          "truncate",
                          task.status === "done" ? "text-muted-foreground line-through" : "text-foreground"
                        )}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        +{dayTasks.length - 2} autres
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming tasks list */}
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Agenda ({sortedDays.length} jour{sortedDays.length > 1 ? "s" : ""})
            </h2>
            {sortedDays.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                Aucune tâche planifiée
              </p>
            ) : (
              <div className="space-y-3">
                {sortedDays.map(([dateStr, dayTasks]) => {
                  const date = new Date(dateStr);
                  const isPast = dateStr < todayStr;
                  return (
                    <div key={dateStr} className="flex gap-4">
                      <div className="w-28 shrink-0">
                        <p className={cn(
                          "text-sm font-medium",
                          isPast ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {formatDate(date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {date.toLocaleDateString("fr-FR", { weekday: "short" })}
                        </p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {dayTasks.map((task) => (
                          <Link
                            key={task.id}
                            href="/tasks"
                            className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5 transition-colors hover:bg-muted/40"
                          >
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium)} />
                            <span className={cn(
                              "flex-1 text-sm",
                              task.status === "done"
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                            )}>
                              {task.title}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {STATUS_LABELS[task.status] ?? task.status}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
