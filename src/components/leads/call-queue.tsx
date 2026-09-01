"use client";

import { useState } from "react";
import Link from "next/link";
import { CallOutcomeForm } from "@/components/leads/call-outcome-form";
import { formatRelative } from "@/lib/utils";
import type { QueueLead } from "@/lib/queries";

const INTENT_LABEL: Record<string, string> = {
  serieux: "sérieux",
  curieux: "curieux",
  hors_cible: "hors cible",
  indetermine: "à qualifier",
};
const INTENT_STYLE: Record<string, string> = {
  serieux: "bg-green-100 text-green-800",
  curieux: "bg-amber-100 text-amber-800",
  hors_cible: "bg-gray-100 text-gray-600",
  indetermine: "bg-gray-100 text-gray-500",
};

export function CallQueue({ leads }: { leads: QueueLead[] }) {
  // Une ligne traitée disparaît de la liste : la file doit fondre au fil des
  // appels, sinon on ne sait plus où on en est.
  const [done, setDone] = useState<Record<string, string>>({});
  // Le formulaire ne s'ouvre que sur la ligne qu'on traite : garder 40
  // formulaires ouverts rendrait la file illisible.
  const [openId, setOpenId] = useState<string | null>(null);

  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Personne à rappeler — aucun lead avec un numéro de téléphone.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((lead, i) => {
        const closed = done[lead.id];
        return (
          <div
            key={lead.id}
            className={
              closed
                ? "rounded-lg border border-border bg-muted/40 p-3 opacity-60"
                : "rounded-lg border border-border bg-card p-3"
            }
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="text-sm font-medium text-foreground hover:underline"
                  >
                    {lead.fullName || "Sans nom"}
                  </Link>
                  {lead.intent && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        INTENT_STYLE[lead.intent] ?? INTENT_STYLE.indetermine
                      }`}
                    >
                      {INTENT_LABEL[lead.intent] ?? lead.intent}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/70">
                    {lead.bootcampName} · {lead.statusName}
                  </span>
                </div>

                {lead.summary && (
                  <p className="mt-1 text-xs text-muted-foreground">{lead.summary}</p>
                )}
                {lead.objection && (
                  <p className="text-xs text-amber-700">Frein : {lead.objection}</p>
                )}

                {lead.nextFollowUpAt && (
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    À rappeler le{" "}
                    {new Date(lead.nextFollowUpAt).toLocaleDateString("fr-FR")}
                  </p>
                )}

                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  {lead.reasons.join(" · ")}
                  {lead.lastCallAt && ` · dernier appel ${formatRelative(lead.lastCallAt)}`}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {lead.mobileNo && (
                  // tel: ouvre le téléphone ou le logiciel d'appel du poste.
                  <a
                    href={`tel:${lead.mobileNo}`}
                    className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {lead.mobileNo}
                  </a>
                )}
                {closed ? (
                  <span className="text-[11px] text-green-600">{closed}</span>
                ) : (
                  <button
                    onClick={() => setOpenId(openId === lead.id ? null : lead.id)}
                    className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                  >
                    {openId === lead.id ? "Fermer" : "Noter l'appel"}
                  </button>
                )}
              </div>
            </div>

            {openId === lead.id && !closed && (
              <div className="mt-3">
                <CallOutcomeForm
                  leadId={lead.id}
                  onDone={(message) => {
                    setDone((d) => ({ ...d, [lead.id]: message }));
                    setOpenId(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
