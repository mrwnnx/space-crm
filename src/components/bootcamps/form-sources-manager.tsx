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
const DEFAULT_MAPPING: Record<string, string> = {
  name: "fullName",
  email: "email",
  phone: "mobileNo",
};
// Colonnes lead whitelistées (doit refléter ALLOWED_LEAD_FIELDS du webhook).
const LEAD_COLUMNS = [
  "email",
  "fullName",
  "firstName",
  "lastName",
  "mobileNo",
  "phone",
  "jobTitle",
  "organizationName",
];

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
  const initialMapping = fs
    ? ((fs.fieldMapping as Record<string, string>) ?? {})
    : DEFAULT_MAPPING;
  const lastPayload = (fs?.lastPayload as Record<string, string> | null) ?? null;

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

      <MappingEditor
        initialMapping={initialMapping}
        lastPayload={lastPayload}
        lastReceivedAt={fs?.lastReceivedAt ?? null}
      />

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

// Panneau "Dernière soumission reçue" + éditeur de mapping basé sur les clés réelles.
function MappingEditor({
  initialMapping,
  lastPayload,
  lastReceivedAt,
}: {
  initialMapping: Record<string, string>;
  lastPayload: Record<string, string> | null;
  lastReceivedAt: Date | string | null;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  // Clés à mapper = celles reçues dans le dernier payload ∪ celles déjà mappées.
  const keys = Array.from(
    new Set([...Object.keys(lastPayload ?? {}), ...Object.keys(mapping)])
  );

  // fieldMapping final envoyé à l'action = entrées non vides uniquement.
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) if (v) cleaned[k] = v;

  return (
    <div className="space-y-2">
      {/* Dernière soumission reçue */}
      <div className="rounded-lg border border-border bg-muted/30 p-2">
        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
          Dernière soumission reçue
          {lastReceivedAt && (
            <span className="ml-1 font-normal">
              · {new Date(lastReceivedAt).toLocaleString("fr-FR")}
            </span>
          )}
        </p>
        {lastPayload && Object.keys(lastPayload).length > 0 ? (
          <pre className="max-h-32 overflow-auto rounded bg-background p-2 text-[10px] text-foreground">
            {JSON.stringify(lastPayload, null, 2)}
          </pre>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            Aucune soumission reçue. Envoie un test depuis ton formulaire Elementor
            (ou via curl) pour voir les champs ici.
          </p>
        )}
      </div>

      {/* Mapping par clé réelle */}
      <Label>Mapping des champs reçus → colonnes lead</Label>
      {keys.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Aucun champ à mapper pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-1">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <code
                className="flex-1 truncate rounded bg-muted px-1.5 py-1 text-[10px] text-muted-foreground"
                title={k}
              >
                {k}
                {lastPayload?.[k] !== undefined && (
                  <span className="ml-1 text-foreground/60">
                    = {String(lastPayload[k])}
                  </span>
                )}
              </code>
              <span className="text-muted-foreground">→</span>
              <select
                value={mapping[k] ?? ""}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [k]: e.target.value }))
                }
                className="rounded-lg border border-border bg-background px-1.5 py-1 text-[10px] outline-none focus:border-ring"
              >
                <option value="">— Ignorer —</option>
                {LEAD_COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Valeur transmise à l'action (whitelist re-filtrée côté webhook). */}
      <input type="hidden" name="fieldMapping" value={JSON.stringify(cleaned)} />
    </div>
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
