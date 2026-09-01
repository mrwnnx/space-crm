"use client";

import { useState, useTransition } from "react";
import { logCallOutcomeAction } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Qualifications prêtes à cliquer. Volontairement courtes : une liste longue
 *  ne se clique pas, elle se contourne. */
export const QUALIFICATIONS = [
  { value: "chaud", label: "🔥 Chaud", style: "bg-red-100 text-red-800 border-red-300" },
  { value: "tiede", label: "Tiède", style: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: "froid", label: "Froid", style: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: "reporte", label: "Prochaine session", style: "bg-violet-100 text-violet-800 border-violet-300" },
  { value: "pas_serieux", label: "Pas sérieux", style: "bg-gray-100 text-gray-700 border-gray-300" },
  { value: "hors_cible", label: "Hors cible", style: "bg-gray-100 text-gray-600 border-gray-300" },
] as const;

const FOLLOW_UPS = [
  { days: 1, label: "demain" },
  { days: 3, label: "dans 3 j" },
  { days: 7, label: "dans 1 sem" },
  { days: 30, label: "dans 1 mois" },
];

export function CallOutcomeForm({
  leadId,
  onDone,
}: {
  leadId: string;
  onDone?: (message: string) => void;
}) {
  const [outcome, setOutcome] = useState<"answered" | "no_answer" | "wrong_number">("answered");
  const [qualification, setQualification] = useState<string | null>(null);
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await logCallOutcomeAction(leadId, {
        outcome,
        qualification,
        followUpDays,
        durationMinutes: minutes ? Number(minutes) : null,
        note,
      });
      if (res.ok) onDone?.(res.message);
    });
  }

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
      {/* Ce qui s'est passé */}
      <div className="flex flex-wrap gap-1">
        {([
          ["answered", "Joint"],
          ["no_answer", "Pas répondu"],
          ["wrong_number", "Faux numéro"],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setOutcome(v)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px]",
              outcome === v
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* La qualification n'a de sens que si on a parlé à quelqu'un. */}
      {outcome === "answered" && (
        <>
          <div className="flex flex-wrap gap-1">
            {QUALIFICATIONS.map((q) => (
              <button
                key={q.value}
                type="button"
                onClick={() => setQualification(qualification === q.value ? null : q.value)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] font-medium",
                  qualification === q.value ? q.style : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            type="number"
            min={0}
            placeholder="durée (min)"
            className="w-28 rounded-md border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-ring"
          />
        </>
      )}

      {/* À rappeler le… — c'est ce champ qui fait remonter le lead au bon moment. */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] text-muted-foreground">Rappeler :</span>
        {FOLLOW_UPS.map((f) => (
          <button
            key={f.days}
            type="button"
            onClick={() => setFollowUpDays(followUpDays === f.days ? null : f.days)}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px]",
              followUpDays === f.days
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Ce qui s'est dit — visible par toute l'équipe"
        className="w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-[11px] outline-none focus:border-ring"
      />

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? "Enregistrement…" : "Enregistrer l'appel"}
      </button>
    </div>
  );
}
