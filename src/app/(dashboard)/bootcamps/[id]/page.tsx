import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { getBootcampById, getLeadsKanban, getLeadSources, getFormSourcesByBootcamp, getTags, getLeadStatuses } from "@/lib/queries";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { cn, formatDate, statusColor } from "@/lib/utils";
import { BootcampActions } from "@/components/bootcamps/bootcamp-actions";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { FormSourcesManager } from "@/components/bootcamps/form-sources-manager";
import { ElementorFormLink } from "@/components/bootcamps/elementor-form-link";

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
  const [bootcamp, kanbanData, sources, formSources, tags, pipelineStatuses] = await Promise.all([
    getBootcampById(id),
    getLeadsKanban(id),
    getLeadSources(),
    getFormSourcesByBootcamp(id),
    getTags(),
    getLeadStatuses(id),
  ]);

  if (!bootcamp) notFound();

  const totalLeads = kanbanData.reduce((sum, s) => sum + s.leads.length, 0);

  // Deux natures de sources : celles liées à un formulaire Elementor (pull par API)
  // et les webhooks classiques (Tally/Elementor push) gérés par FormSourcesManager.
  const elementorSources = formSources.filter((s) => s.elementorFormId);
  const webhookSources = formSources.filter((s) => !s.elementorFormId);

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

      {/* Formulaires Elementor du site (pull par API) */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Formulaire Elementor — thespace.academy
        </h2>
        <p className="mb-3 text-[11px] text-muted-foreground/70">
          Les soumissions du formulaire lié deviennent des leads de cette formation.
          Un formulaire ne peut alimenter qu&apos;une seule formation.
        </p>
        <ElementorFormLink
          bootcampId={bootcamp.id}
          linked={elementorSources.map((s) => ({
            id: s.id,
            name: s.name,
            elementorFormId: s.elementorFormId,
            lastSubmissionId: s.lastSubmissionId,
          }))}
        />
      </div>

      <FormSourcesManager
        bootcampId={bootcamp.id}
        formSources={webhookSources}
        statuses={pipelineStatuses.map((s) => ({ id: s.id, name: s.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
      />

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
