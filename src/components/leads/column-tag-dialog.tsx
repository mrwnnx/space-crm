"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStageTagAction, deleteStageTagAction } from "@/app/actions";

/**
 * « Ceux qui entrent dans cette colonne reçoivent ce tag. »
 *
 * Écran séparé de l'automatisation d'email : poser une étiquette et écrire à
 * quelqu'un n'engagent pas la même chose, et régler l'un ne doit pas obliger à
 * ouvrir l'autre.
 */

export type StageTagRule = {
  statusId: string;
  tagId: string;
  tagName: string;
  tagColor: string;
};

export type TagOption = { id: string; name: string };

export function ColumnTagDialog({
  bootcampId,
  statusId,
  columnName,
  rule,
  tags,
  onClose,
}: {
  bootcampId: string;
  statusId: string;
  columnName: string;
  rule: StageTagRule | null;
  tags: TagOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [tagId, setTagId] = useState(rule?.tagId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveStageTagAction(bootcampId, statusId, tagId);
      if (res?.error) return setError(res.error);
      router.refresh();
      onClose();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteStageTagAction(bootcampId, statusId);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">
          Taguer les entrants de «&nbsp;{columnName}&nbsp;»
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Tout lead qui entre dans cette colonne reçoit ce tag, quel que soit le chemin —
          glisser-déposer, inscription, ou import du site.
        </p>

        {tags.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Aucun tag n&apos;existe encore. Crée-en un depuis l&apos;écran Tags, puis reviens ici.
          </p>
        ) : (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tag</label>
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Choisir…</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dit ce que la règle ne fait PAS : personne ne doit croire qu'elle
            rattrape les leads déjà dans la colonne. */}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Les leads déjà présents dans la colonne ne sont pas tagués — la règle
          s&apos;applique aux entrées à venir. Reposer le même tag ne crée pas de doublon.
        </p>

        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={save}
            disabled={isPending || !tagId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "…" : "Enregistrer"}
          </button>
          {rule && (
            <button
              onClick={remove}
              disabled={isPending}
              className="rounded-lg border border-border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Retirer la règle
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
