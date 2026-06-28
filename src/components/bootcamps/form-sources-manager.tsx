"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFormSourceAction,
  updateFormSourceAction,
  setFormSourceActiveAction,
} from "@/app/actions";
import type { FormSource } from "@/db/schema";

const WEBHOOK_BASE = "https://space-crm-psi.vercel.app";
const DEFAULT_MAPPING_JSON = JSON.stringify(
  { name: "fullName", email: "email", phone: "mobileNo" },
  null,
  2
);

type StatusOption = { id: string; name: string };
type TagOption = { id: string; name: string };

export function FormSourcesManager({
  bootcampId,
  formSources,
  statuses,
  tags,
}: {
  bootcampId: string;
  formSources: FormSource[];
  statuses: StatusOption[];
  tags: TagOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = formSources.filter((f) => f.active).length;

  async function handleSubmit(formData: FormData) {
    const res = editingId
      ? await updateFormSourceAction(editingId, bootcampId, formData)
      : await createFormSourceAction(bootcampId, formData);
    if (res && "error" in res && res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setEditingId(null);
    setCreating(false);
    router.refresh();
  }

  async function toggleActive(fs: FormSource) {
    await setFormSourceActiveAction(fs.id, bootcampId, !fs.active);
    router.refresh();
  }

  function statusName(id: string | null) {
    if (!id) return "1ère colonne";
    return statuses.find((s) => s.id === id)?.name ?? "—";
  }

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/50"
      >
        <span>Formulaires ({formSources.length})</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4">
          {formSources.length === 0 && !creating && (
            <p className="text-xs text-muted-foreground">
              Aucun formulaire. Ajoute-en un pour générer une URL de webhook Elementor.
            </p>
          )}

          {formSources.map((fs) =>
            editingId === fs.id ? (
              <FormSourceForm
                key={fs.id}
                fs={fs}
                statuses={statuses}
                tags={tags}
                error={error}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setEditingId(null);
                  setError(null);
                }}
              />
            ) : (
              <FormSourceRow
                key={fs.id}
                fs={fs}
                statusName={statusName(fs.targetStatusId)}
                onEdit={() => {
                  setEditingId(fs.id);
                  setCreating(false);
                  setError(null);
                }}
                onToggleActive={() => toggleActive(fs)}
              />
            )
          )}

          {creating ? (
            <FormSourceForm
              statuses={statuses}
              tags={tags}
              error={error}
              onSubmit={handleSubmit}
              onCancel={() => {
                setCreating(false);
                setError(null);
              }}
            />
          ) : (
            <button
              onClick={() => {
                setCreating(true);
                setEditingId(null);
                setError(null);
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              + Ajouter un formulaire
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FormSourceRow({
  fs,
  statusName,
  onEdit,
  onToggleActive,
}: {
  fs: FormSource;
  statusName: string;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${WEBHOOK_BASE}/api/webhook/forms/${fs.webhookToken}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{fs.name}</span>
        <span
          className={
            fs.temperature === "hot"
              ? "rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700"
              : "rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
          }
        >
          {fs.temperature === "hot" ? "Chaud" : "Froid"}
        </span>
        {!fs.active && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Inactif
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          → {statusName}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
          {url}
        </code>
        <button
          onClick={copy}
          className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={onEdit}
          className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
        >
          Éditer
        </button>
        <button
          onClick={onToggleActive}
          className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
        >
          {fs.active ? "Désactiver" : "Réactiver"}
        </button>
      </div>
    </div>
  );
}

function FormSourceForm({
  fs,
  statuses,
  tags,
  error,
  onSubmit,
  onCancel,
}: {
  fs?: FormSource;
  statuses: StatusOption[];
  tags: TagOption[];
  error: string | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const selectedTags = (fs?.defaultTagIds as string[] | null) ?? [];
  const mappingValue = fs
    ? JSON.stringify((fs.fieldMapping as Record<string, string>) ?? {}, null, 2)
    : DEFAULT_MAPPING_JSON;

  return (
    <form
      action={onSubmit}
      className="space-y-2 rounded-lg border border-ring bg-background p-3"
    >
      <div>
        <Label>Nom du formulaire *</Label>
        <input
          name="name"
          required
          defaultValue={fs?.name ?? ""}
          placeholder="Inscription"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Colonne d&apos;arrivée</Label>
          <select
            name="targetStatusId"
            defaultValue={fs?.targetStatusId ?? ""}
            className={inputCls}
          >
            <option value="">1ère colonne (défaut)</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Température</Label>
          <select
            name="temperature"
            defaultValue={fs?.temperature ?? "cold"}
            className={inputCls}
          >
            <option value="cold">Froid</option>
            <option value="hot">Chaud</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Tags par défaut</Label>
        {tags.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">Aucun tag existant.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <label
                key={t.id}
                className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground"
              >
                <input
                  type="checkbox"
                  name="tagIds"
                  value={t.id}
                  defaultChecked={selectedTags.includes(t.id)}
                />
                {t.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>Field mapping (JSON : champ Elementor → colonne lead)</Label>
        <textarea
          name="fieldMapping"
          rows={4}
          defaultValue={mappingValue}
          className={`${inputCls} font-mono`}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" name="active" defaultChecked={fs ? fs.active : true} />
        Actif
      </label>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
      {children}
    </label>
  );
}
