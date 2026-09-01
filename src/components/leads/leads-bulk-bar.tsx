"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkDeleteLeadsAction,
  bulkSetLeadStatusAction,
  bulkToggleLeadTagAction,
  carryLeadsOverAction,
} from "@/app/actions";

export type BulkStatus = { id: string; name: string; kind: string; bootcampId: string | null };
export type BulkTag = { id: string; name: string };
export type BulkBootcamp = { id: string; name: string };

/**
 * Barre d'actions groupées. N'apparaît qu'avec une sélection.
 *
 * Deux actions exigent que la sélection tienne dans UNE seule formation :
 * - le changement de colonne, parce que les pipelines sont par formation et
 *   que quatre colonnes « Contacté » à l'écran sont indiscernables ;
 * - le report, parce qu'il part d'une formation source vers une cible.
 * Le tag et la suppression, eux, ne dépendent d'aucune formation.
 */
export function LeadsBulkBar({
  selected,
  bootcampIds,
  statuses,
  tags,
  bootcamps,
  onDone,
  onClear,
  onResult,
}: {
  selected: string[];
  /** Formations distinctes présentes dans la sélection. */
  bootcampIds: string[];
  statuses: BulkStatus[];
  tags: BulkTag[];
  bootcamps: BulkBootcamp[];
  onDone: () => void;
  onClear: () => void;
  /** Le parent affiche le compte rendu : lui survit à la disparition de la barre. */
  onResult: (r: { ok: boolean; message: string } | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const singleBootcamp = bootcampIds.length === 1 ? bootcampIds[0] : null;
  // « Inscrit » exclue : elle demande l'offre et le montant réellement convenu.
  const movable = singleBootcamp
    ? statuses.filter((s) => s.bootcampId === singleBootcamp && s.kind !== "converted")
    : [];
  const carryTargets = singleBootcamp
    ? bootcamps.filter((b) => b.id !== singleBootcamp)
    : [];

  /**
   * `clearAfter` uniquement après une suppression : les leads n'existent plus.
   * Ailleurs on GARDE la sélection — la vider démonte la barre, et le message
   * de confirmation disparaissait avec elle avant qu'on ait pu le lire.
   */
  function run(
    fn: () => Promise<{ ok: boolean; message: string }>,
    clearAfter = false
  ) {
    onResult(null);
    startTransition(async () => {
      const res = await fn();
      onResult(res);
      if (res.ok) {
        router.refresh();
        if (clearAfter) onDone();
      }
    });
  }

  return (
    <div className="border-b border-border bg-muted/40 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-foreground">
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </span>

        {/* Colonne */}
        <select
          defaultValue=""
          disabled={isPending || movable.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v) run(() => bulkSetLeadStatusAction(selected, v));
          }}
          title={
            singleBootcamp
              ? undefined
              : "Sélectionnez des leads d'une seule formation : les colonnes sont propres à chaque pipeline."
          }
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-40"
        >
          <option value="">Déplacer vers…</option>
          {movable.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Tag posé */}
        <select
          defaultValue=""
          disabled={isPending || tags.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v) run(() => bulkToggleLeadTagAction(selected, v, true));
          }}
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-40"
        >
          <option value="">Poser un tag…</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {/* Tag retiré */}
        <select
          defaultValue=""
          disabled={isPending || tags.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v) run(() => bulkToggleLeadTagAction(selected, v, false));
          }}
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-40"
        >
          <option value="">Retirer un tag…</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {/* Report */}
        <select
          defaultValue=""
          disabled={isPending || carryTargets.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = "";
            if (v && singleBootcamp) {
              run(async () => {
                const r = await carryLeadsOverAction(singleBootcamp, v, selected);
                return { ok: r.ok, message: r.message };
              });
            }
          }}
          title={
            singleBootcamp
              ? undefined
              : "Sélectionnez des leads d'une seule formation : le report part d'une source vers une cible."
          }
          className="rounded-lg border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring disabled:opacity-40"
        >
          <option value="">Reporter vers…</option>
          {carryTargets.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1">
          {/* Deux temps : le premier clic ne supprime rien, il demande. */}
          {confirmDelete ? (
            <>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  run(() => bulkDeleteLeadsAction(selected), true);
                }}
                disabled={isPending}
                className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? "…" : `Supprimer ${selected.length} définitivement`}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Annuler
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-red-600 disabled:opacity-40"
            >
              Supprimer
            </button>
          )}
          <button
            onClick={onClear}
            disabled={isPending}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Désélectionner
          </button>
        </div>
      </div>

      {!singleBootcamp && bootcampIds.length > 1 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Sélection répartie sur {bootcampIds.length} formations — « Déplacer » et
          « Reporter » demandent une seule formation.
        </p>
      )}
    </div>
  );
}
