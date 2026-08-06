"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTagAction, updateTagAction, deleteTagAction } from "@/app/actions";
import { statusColor } from "@/lib/utils";

type TagRow = { id: string; name: string; color: string; leadCount: number };

// Doit rester aligné sur STATUS_COLORS (src/lib/utils.ts) et TAG_COLORS (actions.ts).
const COLORS = ["gray", "blue", "purple", "green", "dark-green", "red", "orange", "amber"];

export function TagsManager({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TagRow | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createTagAction(name, color);
      setFeedback(res);
      if (res.ok) setName("");
      router.refresh();
    });
  }

  function remove(tag: TagRow) {
    startTransition(async () => {
      setFeedback(await deleteTagAction(tag.id));
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Création */}
      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-foreground">Nouveau tag</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. instagram, urgent, relancé…"
            maxLength={40}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
          />
        </div>
        <ColorPicker value={color} onChange={setColor} />
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-40"
        >
          Créer
        </button>
      </form>

      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {/* Liste */}
      {tags.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          Aucun tag. Créez-en un ci-dessus — vous pourrez ensuite les poser sur les
          leads, ou les appliquer automatiquement à tout lead venant d&apos;un
          formulaire.
        </p>
      ) : (
        <div className="space-y-1.5">
          {tags.map((tag) =>
            editing === tag.id ? (
              <EditRow
                key={tag.id}
                tag={tag}
                onCancel={() => setEditing(null)}
                onSaved={(res) => {
                  setFeedback(res);
                  setEditing(null);
                  router.refresh();
                }}
              />
            ) : (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <TagChip name={tag.name} color={tag.color} />
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">
                    {tag.leadCount} lead{tag.leadCount > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setEditing(tag.id)}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setConfirmDelete(tag)}
                    className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Supprimer ce tag ?
            </h2>
            <p className="text-xs text-muted-foreground">
              <TagChip name={confirmDelete.name} color={confirmDelete.color} /> sera
              retiré de <strong className="text-foreground">{confirmDelete.leadCount}</strong>{" "}
              lead{confirmDelete.leadCount > 1 ? "s" : ""}, et des formulaires qui
              l&apos;appliquent automatiquement. Les leads eux-mêmes ne sont pas touchés.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => remove(confirmDelete)}
                disabled={isPending}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {isPending ? "Suppression…" : "Supprimer"}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditRow({
  tag,
  onCancel,
  onSaved,
}: {
  tag: TagRow;
  onCancel: () => void;
  onSaved: (res: { ok: boolean; message: string }) => void;
}) {
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-foreground/20 bg-card px-3 py-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none"
      />
      <ColorPicker value={color} onChange={setColor} />
      <button
        onClick={() =>
          startTransition(async () => onSaved(await updateTagAction(tag.id, name, color)))
        }
        disabled={isPending || !name.trim()}
        className="rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-40"
      >
        OK
      </button>
      <button
        onClick={onCancel}
        className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
      >
        Annuler
      </button>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {COLORS.map((c) => {
        const sc = statusColor(c);
        return (
          <button
            key={c}
            type="button"
            aria-label={`Couleur ${c}`}
            onClick={() => onChange(c)}
            className={`h-5 w-5 rounded-full ${sc.dot} ${
              value === c ? "ring-2 ring-foreground ring-offset-1" : "opacity-60"
            }`}
          />
        );
      })}
    </div>
  );
}

export function TagChip({ name, color }: { name: string; color: string }) {
  const sc = statusColor(color);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sc.bg} ${sc.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
      {name}
    </span>
  );
}
