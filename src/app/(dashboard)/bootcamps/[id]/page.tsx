import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getBootcampById, getLeadsKanban, getLeadSources } from "@/lib/queries";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { cn, formatDate, statusColor } from "@/lib/utils";
import { BootcampActions } from "@/components/bootcamps/bootcamp-actions";
import { NewLeadButton } from "@/components/leads/new-lead-button";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

const statusColors: Record<string, string> = {
  draft: "gray",
  open: "blue",
  in_progress: "green",
  completed: "purple",
  cancelled: "red",
};

export default async function BootcampDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bootcamp, kanbanData, sources] = await Promise.all([
    getBootcampById(id),
    getLeadsKanban(id),
    getLeadSources(),
  ]);

  if (!bootcamp) notFound();

  const totalLeads = kanbanData.reduce((sum, s) => sum + s.leads.length, 0);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href="/bootcamps"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold text-foreground font-heading">
              {bootcamp.name}
            </h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusColor(statusColors[bootcamp.status] || "gray")
              )}
            >
              {statusLabels[bootcamp.status] || bootcamp.status}
            </span>
          </div>
          {bootcamp.startDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(bootcamp.startDate)}
              {bootcamp.endDate && ` → ${formatDate(bootcamp.endDate)}`}
              {bootcamp.capacity && ` · ${totalLeads}/${bootcamp.capacity} inscrits`}
            </p>
          )}
        </div>
        <NewLeadButton
          sources={sources}
          lockedBootcamp={{ id: bootcamp.id, name: bootcamp.name }}
        />
        <BootcampActions bootcamp={bootcamp} />
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        {kanbanData.length > 0 ? (
          <LeadsKanban statuses={kanbanData} bootcamp={bootcamp} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Aucune colonne dans le pipeline.
          </div>
        )}
      </div>
    </div>
  );
}
