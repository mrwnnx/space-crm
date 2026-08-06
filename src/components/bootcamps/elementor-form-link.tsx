"use client";

import { useEffect, useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit02Icon } from "@hugeicons/core-free-icons";
import {
  listElementorFormsAction,
  linkElementorFormAction,
  unlinkElementorFormAction,
  importElementorNowAction,
  setElementorMappingAction,
  setElementorRoutingAction,
} from "@/app/actions";

type Stage = { id: string; name: string; kind: string };
type Tag = { id: string; name: string };

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
  targetStatusId: string | null;
  defaultTagIds: string[];
};

type RemoteForm = { id: string; label: string; takenBy: string | null };

export function ElementorFormLink({
  bootcampId,
  linked,
  stages,
  tags,
}: {
  bootcampId: string;
  linked: LinkedSource[];
  stages: Stage[];
  tags: Tag[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barre compacte : le nom du formulaire connecté et rien d'autre. */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Formulaire
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {linked.length === 0 ? (
            <span className="text-xs text-muted-foreground/60">Aucun formulaire lié</span>
          ) : (
            linked.map((s) => (
              <span
                key={s.id}
                className="truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                title={s.elementorFormId ?? undefined}
              >
                {s.name}
              </span>
            ))
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Configurer les formulaires"
          title="Configurer les formulaires"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={PencilEdit02Icon} size={15} />
        </button>
      </div>

      {open && (
        <ElementorFormDialog
          bootcampId={bootcampId}
          linked={linked}
          stages={stages}
          tags={tags}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Tout le paramétrage vit ici : lier / délier, colonne d'arrivée, tags, mapping,
 * import manuel. La liste des formulaires du site n'est chargée QU'À
 * l'ouverture — avant, chaque affichage de page formation déclenchait un appel
 * à l'API WordPress pour rien.
 */
function ElementorFormDialog({
  bootcampId,
  linked,
  stages,
  tags,
  onClose,
}: {
  bootcampId: string;
  linked: LinkedSource[];
  stages: Stage[];
  tags: Tag[];
  onClose: () => void;
}) {
  const [forms, setForms] = useState<RemoteForm[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listElementorFormsAction()
      .then((res) => {
        if (cancelled) return;
        setForms(res.forms);
        setLoadError(res.ok ? null : res.message);
      })
      .catch((e) => {
        // Sans ce catch, un échec réseau (serveur redémarré, hors ligne, timeout)
        // rejetait la promesse sans être traité — « Failed to fetch » en console
        // et composant bloqué sur « Lecture… » pour toujours.
        if (cancelled) return;
        setLoadError(
          e instanceof Error && e.message
            ? `Lecture des formulaires impossible : ${e.message}`
            : "Lecture des formulaires impossible (serveur injoignable)."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true; // évite un setState après démontage
    };
  }, [reloadKey]);

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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground font-heading">
            Formulaires Elementor — thespace.academy
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>
        <p className="mb-4 text-[11px] text-muted-foreground/70">
          Les soumissions du formulaire lié deviennent des leads de cette formation.
          Un formulaire ne peut alimenter qu&apos;une seule formation.
        </p>

        <div className="space-y-3">
          {linked.length > 0 && (
            <div className="space-y-2">
              {linked.map((s) => (
                <LinkedRow
                  key={s.id}
                  source={s}
                  bootcampId={bootcampId}
                  stages={stages}
                  tags={tags}
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
            <div className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2">
              <p className="text-xs text-red-700">{loadError}</p>
              <button
                onClick={() => setReloadKey((k) => k + 1)}
                className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
              >
                Réessayer
              </button>
            </div>
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
      </div>
    </div>
  );
}

function LinkedRow({
  source,
  bootcampId,
  stages,
  tags,
  disabled,
  onUnlink,
  onFeedback,
}: {
  source: LinkedSource;
  bootcampId: string;
  stages: Stage[];
  tags: Tag[];
  disabled: boolean;
  onUnlink: () => void;
  onFeedback: (f: { ok: boolean; message: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>(source.fieldMapping ?? {});
  const [statusId, setStatusId] = useState(source.targetStatusId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(source.defaultTagIds ?? []);
  const [isPending, startTransition] = useTransition();

  // Un lead importé ne doit jamais atterrir dans une colonne terminale :
  // l'inscription passe par enrollLeadAction, pas par l'import.
  const normalStages = stages.filter((s) => s.kind === "normal");

  function saveRouting(nextStatusId: string, nextTagIds: string[]) {
    setStatusId(nextStatusId);
    setTagIds(nextTagIds);
    startTransition(async () => {
      onFeedback(
        await setElementorRoutingAction(source.id, bootcampId, nextStatusId || null, nextTagIds)
      );
    });
  }

  const payloadKeys = Object.keys(source.lastPayload ?? {});
  const unmapped = payloadKeys.filter((k) => !mapping[k]).length;
  // Sans email ni téléphone mappé, aucune soumission ne peut devenir un lead :
  // l'import refusera de démarrer plutôt que de consommer des inscriptions.
  const canIdentify =
    Object.values(mapping).includes("email") ||
    Object.values(mapping).includes("mobileNo");

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

      {/* Routage : où atterrit le lead, et quels tags il porte */}
      <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Colonne d&apos;arrivée
          </label>
          <select
            value={statusId}
            onChange={(e) => saveRouting(e.target.value, tagIds)}
            disabled={disabled || isPending}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none disabled:opacity-50"
          >
            <option value="">1ère colonne (défaut)</option>
            {normalStages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Tags posés sur chaque lead
          </label>
          {tags.length === 0 ? (
            <p className="py-1.5 text-[11px] text-muted-foreground/60">
              Aucun tag créé pour l&apos;instant.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => {
                const on = tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={disabled || isPending}
                    onClick={() =>
                      saveRouting(
                        statusId,
                        on ? tagIds.filter((x) => x !== t.id) : [...tagIds, t.id]
                      )
                    }
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
                      on
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!canIdentify && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          ⚠️ Aucun champ mappé sur <strong>Email</strong> ou <strong>Téléphone</strong> —
          l&apos;import est bloqué (rien n&apos;est consommé). Ouvre « Champs » pour le compléter.
        </p>
      )}

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
