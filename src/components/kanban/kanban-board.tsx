"use client";

import { useState, useTransition } from "react";
import { moveLeadToStage } from "@/app/actions";
import {
  getScoreTier,
  TIER_CONFIG,
  type ScoreTier,
} from "@/lib/scoring";
import { cn, initials, formatRelative } from "@/lib/utils";
import type { Lead, PipelineStage } from "@/db/schema";

type StageWithLeads = PipelineStage & {
  leads: Lead[];
};

const STAGE_COLORS: Record<string, string> = {
  blue: "border-t-blue-500 bg-blue-50/50",
  amber: "border-t-amber-500 bg-amber-50/50",
  purple: "border-t-purple-500 bg-purple-50/50",
  green: "border-t-green-500 bg-green-50/50",
  red: "border-t-red-500 bg-red-50/50",
  slate: "border-t-slate-500 bg-slate-50/50",
};

export function KanbanBoard({ stages }: { stages: StageWithLeads[] }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDrop(leadId: string, stageId: string) {
    setDragOverStage(null);
    setDraggingId(null);
    startTransition(() => moveLeadToStage(leadId, stageId));
  }

  return (
    <div className="flex-1 overflow-x-auto p-6">
      <div className="flex h-full gap-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => {
              e.preventDefault();
              const leadId = e.dataTransfer.getData("text/plain");
              if (leadId) handleDrop(leadId, stage.id);
            }}
            className={cn(
              "flex w-80 shrink-0 flex-col rounded-xl border-t-4",
              STAGE_COLORS[stage.color] ?? STAGE_COLORS.slate,
              dragOverStage === stage.id && "ring-2 ring-indigo-400 ring-offset-2",
              isPending && "opacity-70"
            )}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {stage.name}
              </h2>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-medium text-slate-600">
                {stage.leads.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {stage.leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isDragging={draggingId === lead.id}
                  onDragStart={() => setDraggingId(lead.id)}
                  onDragEnd={() => setDraggingId(null)}
                />
              ))}

              {stage.leads.length === 0 && (
                <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs text-slate-400">
                  Glisser un lead ici
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  lead: Lead;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const tier = getScoreTier(lead.score) as ScoreTier;
  const tierConfig = TIER_CONFIG[tier];

  return (
    <a
      href={`/leads/${lead.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", lead.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        if (isDragging) e.preventDefault();
      }}
      className={cn(
        "block rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold",
              tierConfig.bg,
              tierConfig.color
            )}
          >
            {initials(lead.fullName)}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {lead.fullName}
            </p>
            <p className="text-xs text-slate-400">{lead.source}</p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold ring-1",
            tierConfig.bg,
            tierConfig.color,
            tierConfig.ring
          )}
        >
          {lead.score}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {lead.email && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
            Email
          </span>
        )}
        {lead.whatsapp && (
          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-600">
            WhatsApp
          </span>
        )}
        {lead.cohortInterestId && (
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-600">
            Cohort
          </span>
        )}
      </div>

      <p className="mt-2 text-[10px] text-slate-400">
        Contact: {formatRelative(lead.lastContactedAt)}
      </p>
    </a>
  );
}
