"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listElementorFormsAction,
  linkElementorFormAction,
  unlinkElementorFormAction,
  importElementorNowAction,
  setElementorMappingAction,
} from "@/app/actions";

const MAPPABLE = [
  { value: "", label: "— ignorer —" },
  { value: "email", label: "Email" },
  { value: "fullName", label: "Nom complet" },
  { value: "firstName", label: "Prénom" },
  { value: "lastName", label: "Nom" },
  { value: "mobileNo", label: "Téléphone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "age", label: "Âge" },
  { value: "intendedPlan", label: "Offre (total/mensuel)" },
  { value: "promoCode", label: "Code promo" },
  { value: "jobTitle", label: "Poste" },
  { value: "organizationName", label: "Organisation" },
];

type LinkedSource = {
  id: string;
  name: string;
  elementorFormId: string | null;
  lastSubmissionId: number | null;
  fieldMapping: Record<string, string>;
  lastPayload: Record<string, string> | null;
};

type RemoteForm = { id: string; label: string; takenBy: string | null };

export function ElementorFormLink({
  bootcampId,
  linked,
}: {
  bootcampId: string;
  linked: LinkedSource[];
}) {
  const [forms, setForms] = useState<RemoteForm[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listElementorFormsAction().then((res) => {
      setForms(res.forms);
      setLoadError(res.ok ? null : res.message);
      setLoading(false);
    });
  }, []);

  function link() {
    const form = forms.find((f) => f.id === selected);
    if (!form) return;
    startTransition(async () => {
      const res = await linkElementorFormAction(bootcampId, form.id, form.label);
      setFeedback(res);
      if (res.ok) setSelected("");
    });
  }

  function unlink(sourceId: string) {
    startTransition(async () => {
      setFeedback(await unlinkElementorFormAction(sourceId, bootcampId));
    });
  }

  return (
    <div className="space-y-3">
      {linked.length > 0 && (
        <div className="space-y-2">
          {linked.map((s) => (
            <LinkedRow
              key={s.id}
              source={s}
              bootcampId={bootcampId}
              disabled={isPending}
              onUnlink={() => unlink(s.id)}
              onFeedback={setFeedback}
            />
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Lecture des formulaires du site…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
          >
            <option value="">Choisir un formulaire Elementor…</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id} disabled={!!f.takenBy}>
                {f.label}
                {f.takenBy ? ` — déjà lié à ${f.takenBy}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={link}
            disabled={isPending || !selected}
            className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-40"
          >
            Lier
          </button>
        </div>
      )}

      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function LinkedRow({
  source,
  bootcampId,
  disabled,
  onUnlink,
  onFeedback,
}: {
  source: LinkedSource;
  bootcampId: string;
  disabled: boolean;
  onUnlink: () => void;
  onFeedback: (f: { ok: boolean; message: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>(source.fieldMapping ?? {});
  const [isPending, startTransition] = useTransition();

  const payloadKeys = Object.keys(source.lastPayload ?? {});
  const unmapped = payloadKeys.filter((k) => !mapping[k]).length;

  function runImport() {
    startTransition(async () => {
      onFeedback(await importElementorNowAction(source.id, bootcampId));
    });
  }

  function saveMapping() {
    startTransition(async () => {
      onFeedback(await setElementorMappingAction(source.id, bootcampId, mapping));
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{source.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {source.elementorFormId}
            {source.lastSubmissionId
              ? ` · reprise après la soumission #${source.lastSubmissionId}`
              : " · aucune soumission au moment du lien"}
            {payloadKeys.length > 0 &&
              ` · ${payloadKeys.length - unmapped}/${payloadKeys.length} champs mappés`}
          </p>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1">
          <button
            onClick={runImport}
            disabled={disabled || isPending}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
          >
            {isPending ? "…" : "Importer"}
          </button>
          {payloadKeys.length > 0 && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              {open ? "Fermer" : "Champs"}
            </button>
          )}
          <button
            onClick={onUnlink}
            disabled={disabled || isPending}
            className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
          >
            Délier
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground/70">
            Clés réelles de la dernière soumission. Un lead a besoin d&apos;au moins
            un email ou un téléphone, sinon la soumission est ignorée.
          </p>
          {payloadKeys.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[11px] text-foreground">{key}</p>
                <p className="truncate text-[10px] text-muted-foreground/60">
                  {source.lastPayload?.[key] || "(vide)"}
                </p>
              </div>
              <select
                value={mapping[key] ?? ""}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [key]: e.target.value }))
                }
                className="w-44 shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
              >
                {MAPPABLE.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button
            onClick={saveMapping}
            disabled={isPending}
            className="mt-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
          >
            Enregistrer le mapping
          </button>
        </div>
      )}
    </div>
  );
}
