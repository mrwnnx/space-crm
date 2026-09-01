"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, statusColor, initials, formatRelative } from "@/lib/utils";
import type { LeadWithRelations } from "@/lib/queries";
import { LeadsBulkBar, type BulkStatus, type BulkTag, type BulkBootcamp } from "./leads-bulk-bar";

export function LeadsList({
  leads,
  filterBootcampId,
  filterStatusId,
  filterTemperature,
  filterConverted,
  bootcamps,
  statuses,
  tags,
}: {
  leads: LeadWithRelations[];
  filterBootcampId: string | null;
  filterStatusId: string | null;
  filterTemperature: string | null;
  filterConverted: string | null;
  bootcamps: BulkBootcamp[];
  statuses: BulkStatus[];
  tags: BulkTag[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Le compte rendu vit ICI : après une suppression la sélection se vide, la
  // barre se démonte, et un message porté par la barre disparaîtrait avec elle
  // — sans aucun retour sur l'action la plus lourde de conséquences.
  const [bulkResult, setBulkResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Les ids affichés changent avec les filtres : une sélection qui survivrait à
  // un changement de filtre agirait sur des leads qu'on ne voit plus.
  const visibleIds = leads.map((l) => l.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allChecked = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(visibleIds));
  }

  const bootcampIds = [
    ...new Set(
      leads.filter((l) => selected.has(l.id)).map((l) => l.bootcampId).filter((x): x is string => !!x)
    ),
  ];
  function filterHref(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.bootcamp) sp.set("bootcamp", params.bootcamp);
    if (params.statusId) sp.set("statusId", params.statusId);
    if (params.temperature) sp.set("temperature", params.temperature);
    if (params.converted) sp.set("converted", params.converted);
    const qs = sp.toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        {/* Bootcamp filter */}
        <select
          value={filterBootcampId || ""}
          onChange={(e) => {
            const v = e.target.value;
            window.location.href = filterHref({
              bootcamp: v || undefined,
              statusId: filterStatusId || undefined,
              temperature: filterTemperature || undefined,
              converted: filterConverted || undefined,
            });
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
        >
          <option value="">Toutes les formations</option>
          {bootcamps.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatusId || ""}
          onChange={(e) => {
            const v = e.target.value;
            window.location.href = filterHref({
              bootcamp: filterBootcampId || undefined,
              statusId: v || undefined,
              temperature: filterTemperature || undefined,
              converted: filterConverted || undefined,
            });
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
        >
          <option value="">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Temperature filter */}
        <select
          value={filterTemperature || ""}
          onChange={(e) => {
            const v = e.target.value;
            window.location.href = filterHref({
              bootcamp: filterBootcampId || undefined,
              statusId: filterStatusId || undefined,
              temperature: v || undefined,
              converted: filterConverted || undefined,
            });
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
        >
          <option value="">Toutes températures</option>
          <option value="hot">🔥 Chaud</option>
          <option value="cold">❄️ Froid</option>
        </select>

        {/* Converted filter */}
        <select
          value={filterConverted || ""}
          onChange={(e) => {
            const v = e.target.value;
            window.location.href = filterHref({
              bootcamp: filterBootcampId || undefined,
              statusId: filterStatusId || undefined,
              temperature: filterTemperature || undefined,
              converted: v || undefined,
            });
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring"
        >
          <option value="">Inscrit / Pas inscrit</option>
          <option value="true">Inscrit</option>
          <option value="false">Pas inscrit</option>
        </select>

        {(filterBootcampId || filterStatusId || filterTemperature || filterConverted) && (
          <Link
            href="/leads"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Réinitialiser
          </Link>
        )}
      </div>

      {selectedVisible.length > 0 && (
        <LeadsBulkBar
          selected={selectedVisible}
          bootcampIds={bootcampIds}
          statuses={statuses}
          tags={tags}
          bootcamps={bootcamps}
          onDone={() => setSelected(new Set())}
          onClear={() => {
            setSelected(new Set());
            setBulkResult(null);
          }}
          onResult={setBulkResult}
        />
      )}

      {bulkResult && (
        <div
          className={`flex items-center justify-between gap-2 border-b border-border px-4 py-1.5 text-[11px] ${
            bulkResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          <span>{bulkResult.message}</span>
          <button
            onClick={() => setBulkResult(null)}
            className="shrink-0 rounded px-1.5 py-0.5 hover:bg-black/5"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {leads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
            <p className="text-sm font-medium text-foreground">Aucun lead</p>
            <p className="text-xs text-muted-foreground">
              Créez votre premier lead pour commencer.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border">
                <th className="w-9 pl-5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Tout sélectionner"
                    className="h-3.5 w-3.5 cursor-pointer rounded border-border"
                  />
                </th>
                <Th>Nom</Th>
                <Th>Formation</Th>
                <Th>Statut</Th>
                <Th>Temp.</Th>
                <Th>Inscrit</Th>
                <Th>Source</Th>
                <Th>Email</Th>
                <Th className="pr-5 text-right">Dernier contact</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const sc = lead.status ? statusColor(lead.status.color) : null;
                return (
                  <tr
                    key={lead.id}
                    className="group border-b border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="pl-5">
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        aria-label={`Sélectionner ${lead.fullName}`}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-border"
                      />
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="flex items-center gap-2.5"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {initials(lead.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover:text-primary">
                            {lead.fullName}
                          </p>
                          {lead.jobTitle && (
                            <p className="text-xs text-muted-foreground">
                              {lead.jobTitle}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/bootcamps/${lead.bootcampId}`}
                        className="text-sm text-muted-foreground hover:text-primary"
                      >
                        {lead.bootcamp?.name || "—"}
                      </Link>
                    </td>
                    <td>
                      {sc && lead.status && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                            sc.bg,
                            sc.text
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                          {lead.status.name}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={cn(
                        "text-xs font-medium",
                        lead.temperature === "hot" ? "text-orange-500" : "text-blue-400"
                      )}>
                        {lead.temperature === "hot" ? "🔥 Chaud" : "❄️ Froid"}
                      </span>
                    </td>
                    <td>
                      {lead.converted ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          Oui
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">Non</span>
                      )}
                    </td>
                    <td>
                      <span className="text-sm text-muted-foreground">
                        {lead.source?.name || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-muted-foreground">
                        {lead.email || "—"}
                      </span>
                    </td>
                    <td className="pr-5 text-right">
                      <span className="text-xs text-muted-foreground">
                        {formatRelative(lead.lastContactedAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}
