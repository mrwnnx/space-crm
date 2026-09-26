"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applySuggestedTemperatureAction } from "@/app/actions";
import { cn } from "@/lib/utils";

type Signal = { sens: "chaud" | "froid" | "frein"; label: string };

const SENS: Record<Signal["sens"], { icone: string; cls: string }> = {
  chaud: { icone: "🔥", cls: "text-orange-800" },
  froid: { icone: "❄️", cls: "text-sky-800" },
  frein: { icone: "⚠️", cls: "text-amber-800" },
};

/**
 * La température que PROPOSE la lecture IA, sa preuve, et un bouton
 * « Appliquer ». Proposer, pas imposer : rien ne change sans ce clic.
 * Les signaux WhatsApp sont ceux calculés au moment de la lecture — des faits,
 * que le commercial peut vérifier dans le fil.
 */
export function TemperatureProposal({
  leadId,
  current,
  suggested,
  proof,
  nextAction,
  signals,
}: {
  leadId: string;
  current: "hot" | "cold";
  suggested: "hot" | "cold" | null;
  proof: string | null;
  nextAction: string | null;
  signals: Signal[] | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (!suggested && !nextAction && !signals?.length) return null;
  const differe = !!suggested && suggested !== current;

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {suggested && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-2 text-sm",
            differe ? (suggested === "hot" ? "bg-orange-50" : "bg-sky-50") : "bg-muted/40"
          )}
        >
          <span className="font-medium text-foreground">
            Température proposée : {suggested === "hot" ? "🔥 chaud" : "❄️ froid"}
          </span>
          {proof && <span className="text-[13px] text-muted-foreground">— {proof}</span>}
          {differe ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setErreur(null);
                  const r = await applySuggestedTemperatureAction(leadId);
                  if ("error" in r && r.error) setErreur(r.error);
                  else router.refresh();
                })
              }
              className="ml-auto rounded-md border border-border bg-background px-2 py-0.5 text-[12px] font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {pending ? "…" : "Appliquer"}
            </button>
          ) : (
            <span className="ml-auto text-[12px] text-muted-foreground">= actuelle</span>
          )}
        </div>
      )}
      {erreur && <p className="text-[12px] text-red-700">{erreur}</p>}

      {nextAction && (
        <p className="text-sm text-foreground">
          <span className="font-medium">Prochaine action :</span> {nextAction}
        </p>
      )}

      {!!signals?.length && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Signaux WhatsApp
          </p>
          <ul className="mt-1 space-y-0.5">
            {signals.map((s) => (
              <li key={s.label} className={cn("text-[13px]", SENS[s.sens].cls)}>
                {SENS[s.sens].icone} {s.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
