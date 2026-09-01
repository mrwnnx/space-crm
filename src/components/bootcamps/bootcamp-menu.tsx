"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import type { Bootcamp } from "@/db/schema";
import type { CarryCandidate } from "@/lib/queries";
import { BootcampActions } from "./bootcamp-actions";
import { ElementorFormLink } from "./elementor-form-link";
import { AnalyzeLeadsButton } from "./analyze-leads-button";
import { CarryOverPanel } from "./carry-over-panel";

type LinkedSource = React.ComponentProps<typeof ElementorFormLink>["linked"][number];
type Stage = React.ComponentProps<typeof ElementorFormLink>["stages"][number];
type Tag = React.ComponentProps<typeof ElementorFormLink>["tags"][number];

/**
 * Toutes les actions de la formation derrière UNE icône.
 *
 * Avant, statut, offre, suppression, formulaires, analyse IA et report
 * occupaient deux bandeaux sous l'en-tête : ~90 px pris au kanban en
 * permanence pour des réglages qu'on ouvre une fois par semaine.
 */
export function BootcampMenu({
  bootcamp,
  linked,
  stages,
  tags,
  pendingAnalysis,
  carryCandidates,
  carryTargets,
}: {
  bootcamp: Bootcamp;
  linked: LinkedSource[];
  stages: Stage[];
  tags: Tag[];
  pendingAnalysis: number;
  carryCandidates: CarryCandidate[];
  carryTargets: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Actions de la formation"
        title="Actions de la formation"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={Settings02Icon} size={16} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-foreground font-heading">
                  {bootcamp.name}
                </h2>
                <p className="text-[11px] text-muted-foreground">Actions de la formation</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-4">
              <Section title="Formulaires">
                <ElementorFormLink
                  bootcampId={bootcamp.id}
                  linked={linked}
                  stages={stages}
                  tags={tags}
                />
              </Section>

              <Section title="Statut, offre et suppression">
                <BootcampActions bootcamp={bootcamp} />
              </Section>

              {pendingAnalysis > 0 && (
                <Section title="Lecture IA">
                  <AnalyzeLeadsButton bootcampId={bootcamp.id} pending={pendingAnalysis} />
                </Section>
              )}

              {carryTargets.length > 0 && carryCandidates.length > 0 && (
                <Section title="Report vers la session suivante">
                  <CarryOverPanel
                    bootcampId={bootcamp.id}
                    candidates={carryCandidates}
                    targets={carryTargets}
                  />
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
