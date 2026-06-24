"use client";

import { useState, useTransition } from "react";
import { enrollLead, enrollAllStaleLeads } from "@/app/actions";
import { cn, formatRelative } from "@/lib/utils";
import type { Sequence } from "@/db/schema";

type StaleLead = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  score: number;
  lastContactedAt: Date | null;
  source: string | null;
};

export function StaleLeadsList({
  leads,
  sequences,
}: {
  leads: StaleLead[];
  sequences: Sequence[];
}) {
  const [selectedSeq, setSelectedSeq] = useState<string>("");
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  async function handleEnroll(leadId: string) {
    if (!selectedSeq) return;
    startBulk(async () => {
      const result = await enrollLead(leadId, selectedSeq);
      if (result.ok) {
        setEnrolledIds((prev) => new Set(prev).add(leadId));
      }
    });
  }

  async function handleEnrollAll() {
    if (!selectedSeq) return;
    const ids = leads
      .filter((l) => !enrolledIds.has(l.id))
      .map((l) => l.id);
    if (ids.length === 0) return;

    startBulk(async () => {
      const result = await enrollAllStaleLeads(selectedSeq, ids);
      if (result.enrolled > 0) {
        setEnrolledIds((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      {sequences.length > 0 && leads.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3">
          <select
            value={selectedSeq}
            onChange={(e) => setSelectedSeq(e.target.value)}
            className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">Sélectionner une séquence...</option>
            {sequences.map((seq) => (
              <option key={seq.id} value={seq.id}>
                {seq.name} ({seq.status})
              </option>
            ))}
          </select>
          <button
            onClick={handleEnrollAll}
            disabled={!selectedSeq || bulkPending}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {bulkPending ? "..." : "Tout inscrire"}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {leads.slice(0, 30).map((lead) => {
          const isEnrolled = enrolledIds.has(lead.id);
          return (
            <div
              key={lead.id}
              className={cn(
                "flex items-center justify-between rounded-lg border p-3 transition-colors",
                isEnrolled
                  ? "border-green-200 bg-green-50/50"
                  : "border-slate-100 bg-white hover:bg-slate-50"
              )}
            >
              <a
                href={`/leads/${lead.id}`}
                className="flex-1"
              >
                <p className="text-sm font-medium text-slate-900">
                  {lead.fullName}
                </p>
                <p className="text-xs text-slate-400">
                  Dernier contact: {formatRelative(lead.lastContactedAt)}
                  {lead.source && ` · ${lead.source}`}
                </p>
              </a>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
                  {lead.score}
                </span>
                {selectedSeq && !isEnrolled && (
                  <button
                    onClick={() => handleEnroll(lead.id)}
                    disabled={bulkPending}
                    className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                  >
                    Inscrire
                  </button>
                )}
                {isEnrolled && (
                  <span className="text-xs font-medium text-green-600">
                    ✓ Inscrit
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {leads.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          Aucun lead à relancer
        </p>
      )}

      {leads.length > 30 && (
        <p className="text-center text-xs text-slate-400">
          Affichage des 30 premiers leads sur {leads.length}
        </p>
      )}
    </div>
  );
}
