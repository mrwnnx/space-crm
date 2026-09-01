"use client";

import { useState, useTransition } from "react";
import { carryLeadsOverAction } from "@/app/actions";
import type { CarryCandidate } from "@/lib/queries";

const QUALIF_LABEL: Record<string, string> = {
  chaud: "🔥 chaud",
  tiede: "tiède",
  froid: "froid",
  reporte: "prochaine session",
};

/**
 * Reporter les leads non conclus vers la session suivante.
 *
 * C'est le moment où l'argent se perd : une formation se remplit, on ouvre la
 * suivante, et les gens à qui on avait parlé disparaissent du radar.
 */
export function CarryOverPanel({
  bootcampId,
  candidates,
  targets,
}: {
  bootcampId: string;
  candidates: CarryCandidate[];
  targets: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(
    // Par défaut on reporte ceux qu'on a qualifiés : ce sont les
    // conversations déjà engagées.
    new Set(candidates.filter((c) => !c.alreadyThere && c.qualification).map((c) => c.id))
  );
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (targets.length === 0 || candidates.length === 0) return null;

  const movable = candidates.filter((c) => !c.alreadyThere);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run() {
    startTransition(async () => {
      const res = await carryLeadsOverAction(bootcampId, target, [...selected]);
      setResult(res.message);
      if (res.ok && res.created > 0) setSelected(new Set());
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            Reporter les leads non conclus
          </p>
          <p className="text-[10px] text-muted-foreground">
            {movable.length} personne{movable.length > 1 ? "s" : ""} ni inscrite
            {movable.length > 1 ? "s" : ""} ni perdue{movable.length > 1 ? "s" : ""}.
            Elles gardent leur qualification et un lien vers leur fiche d&apos;origine.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
        >
          {open ? "Fermer" : "Reporter"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Vers :</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={run}
              disabled={isPending || selected.size === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "…" : `Reporter ${selected.size}`}
            </button>
            {result && <span className="text-[11px] text-green-600">{result}</span>}
          </div>

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((c) => (
              <label
                key={c.id}
                className={
                  c.alreadyThere
                    ? "flex items-center gap-2 rounded-md px-2 py-1 text-xs opacity-40"
                    : "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted"
                }
              >
                <input
                  type="checkbox"
                  disabled={c.alreadyThere}
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 truncate text-foreground">
                  {c.fullName || c.email}
                </span>
                {c.qualification && (
                  <span className="text-[10px] text-muted-foreground">
                    {QUALIF_LABEL[c.qualification] ?? c.qualification}
                  </span>
                )}
                {c.calls > 0 && (
                  <span className="text-[10px] text-muted-foreground/70">
                    {c.calls} appel{c.calls > 1 ? "s" : ""}
                  </span>
                )}
                {c.alreadyThere && (
                  <span className="text-[10px] text-muted-foreground/70">déjà présent</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
