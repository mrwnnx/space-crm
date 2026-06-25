import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon, Briefcase02Icon, Task01Icon, Analytics01Icon } from "@hugeicons/core-free-icons";
import { getLeadStats, getDealStats, getTaskStats, getLeads, getTasks } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { cn, initials, formatRelative, statusColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [leadStats, dealStats, taskStats, recentLeads, recentTasks] = await Promise.all([
    getLeadStats(),
    getDealStats(),
    getTaskStats(),
    getLeads(),
    getTasks(),
  ]);

  const recent5Leads = recentLeads.slice(0, 5);
  const overdueTasks = recentTasks
    .filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done")
    .slice(0, 5);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Vue d'ensemble" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={User02Icon}
              label="Leads"
              value={leadStats.total}
              sub={`${leadStats.converted} convertis`}
              href="/leads"
            />
            <KpiCard
              icon={Briefcase02Icon}
              label="Deals"
              value={dealStats.total}
              sub={`${dealStats.won} gagnés`}
              href="/deals"
            />
            <KpiCard
              icon={Analytics01Icon}
              label="Pipeline"
              value={`${Number(dealStats.totalValue).toLocaleString("fr-FR")} €`}
              sub="valeur totale"
              href="/deals"
            />
            <KpiCard
              icon={Task01Icon}
              label="Tasks"
              value={taskStats.total}
              sub={`${taskStats.done} done · ${taskStats.overdue} en retard`}
              href="/tasks"
              alert={taskStats.overdue > 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Recent leads */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground font-heading">
                  Leads récents
                </h2>
                <Link href="/leads" className="text-xs text-primary hover:text-primary/80">
                  Voir tout →
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-card">
                {recent5Leads.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    Aucun lead
                  </p>
                ) : (
                  recent5Leads.map((lead) => {
                    const sc = lead.status ? statusColor(lead.status.color) : null;
                    return (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-3 border-b border-border p-3 last:border-0 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {initials(lead.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {lead.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {lead.email || lead.mobileNo || "—"}
                          </p>
                        </div>
                        {sc && lead.status && (
                          <span className={cn("flex items-center gap-1 text-xs", sc.text)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                            {lead.status.name}
                          </span>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </section>

            {/* Overdue tasks */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground font-heading">
                  Tâches en retard
                </h2>
                <Link href="/tasks" className="text-xs text-primary hover:text-primary/80">
                  Voir tout →
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-card">
                {overdueTasks.length === 0 ? (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    Aucune tâche en retard 🎉
                  </p>
                ) : (
                  overdueTasks.map((task) => (
                    <Link
                      key={task.id}
                      href="/tasks"
                      className="flex items-center gap-3 border-b border-border p-3 last:border-0 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs text-red-600">
                        !
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {task.title}
                        </p>
                        <p className="truncate text-xs text-red-500">
                          {formatRelative(task.dueDate)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  href,
  alert,
}: {
  icon: typeof User02Icon;
  label: string;
  value: string | number;
  sub: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40",
        alert && "border-red-200"
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", alert ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
          <HugeiconsIcon icon={icon} size={16} />
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground font-heading">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}
