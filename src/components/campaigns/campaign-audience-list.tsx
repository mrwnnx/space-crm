"use client";

import { useMemo, useState } from "react";
import type { RecipientRow } from "@/lib/campaigns/queries";

const STATUS: Record<string, { text: string; className: string }> = {
  pending: { text: "En attente", className: "text-muted-foreground" },
  sent: { text: "Envoyé", className: "text-foreground" },
  bounced: { text: "Rebond", className: "text-red-600" },
  complained: { text: "Plainte", className: "text-red-600" },
  failed: { text: "Échec", className: "text-red-600" },
  skipped: { text: "Ignoré", className: "text-amber-700" },
  delayed: { text: "Différé", className: "text-amber-700" },
};

/** Filtres d'engagement, qui se superposent au statut d'envoi. */
type Filter = "all" | "opened" | "clicked" | "unsubscribed" | "problem";

const time = (d: Date | null) =>
  d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export function CampaignAudienceList({ rows }: { rows: RecipientRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [chrono, setChrono] = useState(false);

  const counts = useMemo(() => ({
    all: rows.length,
    opened: rows.filter((r) => r.openedAt).length,
    clicked: rows.filter((r) => r.clickedAt).length,
    unsubscribed: rows.filter((r) => r.unsubscribedAt).length,
    problem: rows.filter((r) => ["bounced", "complained", "failed", "skipped"].includes(r.status)).length,
  }), [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (needle && !r.email.toLowerCase().includes(needle) && !(r.fullName ?? "").toLowerCase().includes(needle)) return false;
      if (filter === "opened") return !!r.openedAt;
      if (filter === "clicked") return !!r.clickedAt;
      if (filter === "unsubscribed") return !!r.unsubscribedAt;
      if (filter === "problem") return ["bounced", "complained", "failed", "skipped"].includes(r.status);
      return true;
    });
    if (chrono) {
      // Chronologie : le plus récemment actif d'abord — clic, puis ouverture,
      // puis envoi. C'est l'ordre dans lequel les choses se sont passées.
      out = [...out].sort((a, b) => {
        const t = (r: RecipientRow) =>
          new Date(r.clickedAt ?? r.openedAt ?? r.sentAt ?? 0).getTime();
        return t(b) - t(a);
      });
    }
    return out;
  }, [rows, q, filter, chrono]);

  if (rows.length === 0) return null;

  const chip = (f: Filter, label: string, n: number) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      disabled={n === 0 && f !== "all"}
      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:opacity-40 ${
        filter === f
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40"
      }`}
    >
      {label} <span className="opacity-60">{n}</span>
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher une adresse ou un nom…"
          className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
        />
        <button
          onClick={() => setChrono((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
            chrono ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
          }`}
          title="Trier par activité la plus récente"
        >
          Chronologie
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {chip("all", "Tous", counts.all)}
        {chip("opened", "Ouvert", counts.opened)}
        {chip("clicked", "Cliqué", counts.clicked)}
        {chip("unsubscribed", "Désinscrit", counts.unsubscribed)}
        {chip("problem", "Problème", counts.problem)}
      </div>

      <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {shown.map((r) => {
          const badge = STATUS[r.status] ?? STATUS.pending;
          return (
            <li key={r.id} className="px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                  {r.fullName ? `${r.fullName} — ` : ""}
                  {r.email}
                </span>
                <span className={`shrink-0 text-xs ${badge.className}`}>{badge.text}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {r.sentAt ? `envoyé ${time(r.sentAt)}` : "pas encore envoyé"}
                {r.deliveredAt && " · délivré"}
                {r.openedAt && ` · ouvert ${time(r.openedAt)}${r.openCount > 1 ? ` (${r.openCount}×)` : ""}`}
                {r.clickedAt && ` · cliqué ${time(r.clickedAt)}${r.clickCount > 1 ? ` (${r.clickCount}×)` : ""}`}
                {r.unsubscribedAt && (
                  <span className="text-red-600"> · désinscrit {time(r.unsubscribedAt)}</span>
                )}
              </p>
              {r.error && (
                <p className="mt-0.5 truncate text-xs text-red-600" title={r.error}>
                  {r.error}
                </p>
              )}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-muted-foreground">
            Aucun destinataire ne correspond.
          </li>
        )}
      </ul>
    </div>
  );
}
