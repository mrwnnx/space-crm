"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveColumnAutomationAction,
  deleteColumnAutomationAction,
} from "@/app/actions";
import { listApprovedTemplatesAction } from "@/app/whatsapp-actions";
import { AUTOMATION_DELAYS, timingLabel } from "@/lib/automation-delays";
import { AutomationStatsDialog } from "@/components/leads/automation-stats-dialog";
import { ApercuModele } from "@/components/whatsapp/template-preview";

/** Règle d'une colonne, telle que la page la charge. */
export type ColumnAutomation = {
  id: string;
  statusId: string;
  /** 'email' | 'whatsapp' */
  channel: string;
  /** Nul sur une règle WhatsApp. */
  emailTemplateId: string | null;
  whatsappTemplate: string | null;
  whatsappLanguage: string;
  /** Les noms des variables du CRM, dans l'ordre attendu par Meta. */
  whatsappVariables: unknown;
  delayMinutes: number;
  /** « J+n à h h » (Tunis) ; atHour nul = delayMinutes fait foi. */
  delayDays?: number;
  atHour?: number | null;
  active: boolean;
  /** Posé quand Meta a arrêté la règle (modèle en pause) ; nul sinon. */
  pausedReason?: string | null;
  /** Nuls sur une règle WhatsApp (jointure externe). */
  templateName: string | null;
  templateSubject: string | null;
};

export type TemplateOption = { id: string; name: string; subject: string | null };

/**
 * Les variables que le CRM sait remplir — celles de `buildVariables`.
 * Tenue à la main : une liste dérivée du serveur obligerait à importer un
 * module serveur dans un composant client.
 */
const VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "formation",
  "dateDebut",
  "offre",
  "email",
] as const;

/**
 * La fenêtre d'une colonne : la liste de ses règles (une séquence en a
 * plusieurs), et le formulaire d'une règle quand on en ajoute ou modifie une.
 */
export function ColumnAutomationDialog({
  bootcampId,
  statusId,
  columnName,
  automations,
  templates,
  onClose,
}: {
  bootcampId: string;
  statusId: string;
  columnName: string;
  automations: ColumnAutomation[];
  templates: TemplateOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  // Sans règle, on ouvre directement le formulaire : c'est ce qu'on venait faire.
  const [editing, setEditing] = useState<ColumnAutomation | "new" | null>(
    automations.length === 0 ? "new" : null
  );
  const [stats, setStats] = useState<ColumnAutomation | null>(null);
  const [isPending, startTransition] = useTransition();

  if (editing) {
    return (
      <RuleForm
        bootcampId={bootcampId}
        statusId={statusId}
        columnName={columnName}
        automation={editing === "new" ? null : editing}
        templates={templates}
        onClose={() => (automations.length === 0 ? onClose() : setEditing(null))}
      />
    );
  }

  function remove(a: ColumnAutomation) {
    startTransition(async () => {
      await deleteColumnAutomationAction(bootcampId, a.id);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
          Automatisations de « {columnName} »
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Chaque message part <strong>une seule fois</strong> par lead, à son moment. La suite
          s&apos;arrête dès que le lead répond sur WhatsApp, change de colonne ou s&apos;inscrit.
        </p>

        <ul className="mb-4 space-y-2">
          {automations.map((a) => (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[12px] uppercase text-muted-foreground">
                      {a.channel === "whatsapp" ? "WhatsApp" : "Email"}
                    </span>
                    {a.templateName ?? a.whatsappTemplate ?? "—"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {timingLabel(a)}
                    {!a.active && (
                      <span className="ml-2 rounded bg-amber-50 px-1 py-0.5 text-amber-700">
                        {a.pausedReason ? "arrêtée par Meta" : "inactive"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(a)}
                    className="rounded-md border border-border px-2 py-1 text-[13px] text-foreground hover:bg-muted"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setStats(a)}
                    className="rounded-md border border-border px-2 py-1 text-[13px] text-foreground hover:bg-muted"
                  >
                    Stats
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => remove(a)}
                    className="rounded-md border border-red-500/30 px-2 py-1 text-[13px] text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + Ajouter un message
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Fermer
          </button>
        </div>

        {stats && (
          <AutomationStatsDialog
            automationId={stats.id}
            columnName={columnName}
            templateName={stats.templateName ?? stats.whatsappTemplate ?? "—"}
            onClose={() => setStats(null)}
          />
        )}
      </div>
    </div>
  );
}

function RuleForm({
  bootcampId,
  statusId,
  columnName,
  automation,
  templates,
  onClose,
}: {
  bootcampId: string;
  statusId: string;
  columnName: string;
  automation: ColumnAutomation | null;
  templates: TemplateOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [canal, setCanal] = useState<"email" | "whatsapp">(
    automation?.channel === "whatsapp" ? "whatsapp" : "email"
  );
  const [templateId, setTemplateId] = useState(automation?.emailTemplateId ?? "");
  const [waTemplate, setWaTemplate] = useState(automation?.whatsappTemplate ?? "");
  const [waLangue, setWaLangue] = useState(automation?.whatsappLanguage ?? "fr");
  const [waVars, setWaVars] = useState<string[]>(
    Array.isArray(automation?.whatsappVariables)
      ? (automation!.whatsappVariables as string[])
      : []
  );
  // Une valeur fixe en cours de saisie (« lundi 28 septembre, 19h »).
  const [waFixe, setWaFixe] = useState("");
  // Les modèles approuvés chez Meta, chargés quand on choisit le canal
  // WhatsApp. `null` = pas encore chargés ; vide = Meta injoignable, on
  // retombe sur la saisie du nom.
  const [waCatalogue, setWaCatalogue] = useState<
    Awaited<ReturnType<typeof listApprovedTemplatesAction>> | null
  >(null);
  useEffect(() => {
    if (canal !== "whatsapp" || waCatalogue !== null) return;
    listApprovedTemplatesAction(bootcampId)
      .then(setWaCatalogue)
      .catch(() => setWaCatalogue({ modeles: [], exemples: { fr: {}, ar: {} } }));
  }, [canal, waCatalogue, bootcampId]);
  const waModeles = waCatalogue?.modeles ?? null;
  const waModele = waModeles?.find((m) => m.name === waTemplate && m.language === waLangue);
  // Les valeurs d'exemple dans la langue du modèle : la date change d'écriture.
  const waExemples = waCatalogue?.exemples[waLangue.startsWith("ar") ? "ar" : "fr"] ?? {};
  const ajouterFixe = () => {
    const v = waFixe.trim();
    if (!v || waVars.includes(v)) return;
    setWaVars((prev) => [...prev, v]);
    setWaFixe("");
  };
  const [delay, setDelay] = useState(automation?.delayMinutes ?? 0);
  const [delayDays, setDelayDays] = useState(automation?.delayDays ?? 0);
  const [atHour, setAtHour] = useState<number | null>(automation?.atHour ?? null);
  const [active, setActive] = useState(automation?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveColumnAutomationAction(
        bootcampId,
        statusId,
        templateId,
        delay,
        active,
        canal,
        canal === "whatsapp"
          ? { template: waTemplate, langue: waLangue, variables: waVars }
          : undefined,
        { delayDays, atHour },
        automation?.id
      );
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function remove() {
    if (!automation) return;
    startTransition(async () => {
      await deleteColumnAutomationAction(bootcampId, automation.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {/* En-tête et pied restent visibles ; seul le corps défile. Sur un écran
          large, le corps se coupe en deux colonnes : ce qu'on envoie à gauche,
          l'aperçu et le moment à droite — un 14 pouces voit tout sans défiler. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="px-5 pt-5">
          <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
            {automation ? "Modifier le message" : "Nouveau message"} — « {columnName} »
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Chaque lead qui entre dans cette colonne le reçoit — <strong>une seule fois</strong>,
            quel que soit le chemin&nbsp;: glisser-déposer, inscription, ou import du site.
          </p>
        </div>

        <div className="grid flex-1 gap-x-6 overflow-y-auto px-5 md:grid-cols-2">
        <div>
        {/* Le canal se choisit AVANT le modèle : c'est lui qui décide de ce que
            le reste de la fenêtre demande. */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {(
            [
              ["email", "Email"],
              ["whatsapp", "WhatsApp"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setCanal(v)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                canal === v
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {canal === "whatsapp" && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Modèle approuvé par Meta
              </label>
              {waModeles === null ? (
                <p className="text-[13px] text-muted-foreground">Chargement des modèles…</p>
              ) : waModeles.length > 0 ? (
                <>
                  <select
                    value={waModele ? `${waModele.name}|${waModele.language}` : ""}
                    onChange={(e) => {
                      const [name, language] = e.target.value.split("|");
                      setWaTemplate(name ?? "");
                      setWaLangue(language ?? "fr");
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">Choisir un modèle…</option>
                    {waModeles.map((m) => (
                      <option key={`${m.name}|${m.language}`} value={`${m.name}|${m.language}`}>
                        {m.name} — {m.language} · {m.category === "MARKETING" ? "marketing" : "utilitaire"}
                        {m.variables ? ` · ${m.variables} variable${m.variables > 1 ? "s" : ""}` : ""}
                      </option>
                    ))}
                  </select>
                  {waModele && (
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {waModele.variables
                        ? `Attend ${waModele.variables} variable${waModele.variables > 1 ? "s" : ""} ({{1}}…{{${waModele.variables}}}) — choisis-les ci-dessous, dans l'ordre.`
                        : "Aucune variable."}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <input
                    value={waTemplate}
                    onChange={(e) => setWaTemplate(e.target.value.toLowerCase())}
                    placeholder="brochure_programme"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Meta injoignable : tape le nom exact du modèle approuvé (minuscules, chiffres,
                    underscores).
                  </p>
                </>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Langue</label>
              <input
                value={waLangue}
                onChange={(e) => setWaLangue(e.target.value)}
                placeholder="fr"
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1 text-[13px] text-muted-foreground">
                Exactement le code déclaré avec le modèle : <code>fr</code>, <code>en_US</code>,
                <code>ar</code>…
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Variables, dans l&apos;ordre
              </label>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => {
                  const rang = waVars.indexOf(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setWaVars((prev) =>
                          prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[13px] transition-colors ${
                        rang >= 0
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {rang >= 0 && (
                        <span className="mr-1 font-mono font-semibold">{`{{${rang + 1}}}`}</span>
                      )}
                      {v}
                    </button>
                  );
                })}
                {waVars
                  .filter((v) => !(VARIABLES as readonly string[]).includes(v))
                  .map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setWaVars((prev) => prev.filter((x) => x !== v))}
                      title="Retirer"
                      className="rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-[13px] text-foreground"
                    >
                      <span className="mr-1 font-mono font-semibold">{`{{${waVars.indexOf(v) + 1}}}`}</span>
                      « {v} »
                    </button>
                  ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={waFixe}
                  onChange={(e) => setWaFixe(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      ajouterFixe();
                    }
                  }}
                  placeholder="Valeur fixe, ex. lundi 28 septembre, 19h"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={ajouterFixe}
                  disabled={!waFixe.trim()}
                  className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Meta ne connaît pas les noms : ses modèles portent{" "}
                <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… C&apos;est l&apos;ordre de
                sélection qui fait la correspondance. Clique pour ajouter ou retirer. Une
                valeur fixe part telle quelle, la même pour tous les leads.
              </p>
            </div>

            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] leading-relaxed text-amber-700 dark:text-amber-500">
              Un lead sans numéro de téléphone est ignoré, comme une règle email ignore un lead
              sans adresse.
            </p>
          </div>
        )}

        {canal === "email" && (
        <>
        <label className="mb-1 block text-xs font-medium text-foreground">
          Modèle d&apos;email
        </label>
        {templates.length === 0 ? (
          <p className="mb-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            Aucun modèle d&apos;email.{" "}
            <Link href="/settings?tab=emails" className="text-primary underline">
              En créer un
            </Link>
            .
          </p>
        ) : (
          <>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Choisir un modèle…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!t.subject?.trim()}>
                  {t.name}
                  {!t.subject?.trim() ? " — sans objet, inutilisable" : ""}
                </option>
              ))}
            </select>
            <p className="mb-3 text-[13px] text-muted-foreground">
              <Link href="/settings?tab=emails" className="text-primary underline">
                Créer ou modifier un modèle
              </Link>
            </p>
          </>
        )}

        </>
        )}
        </div>

        <div>
        {canal === "whatsapp" && waModele?.body && (
          <ApercuModele
            body={waModele.body}
            buttons={waModele.buttons}
            valeurs={waVars.map((v) => waExemples[v] ?? v)}
          />
        )}

        <label className="mb-1 block text-xs font-medium text-foreground">
          Quand l&apos;envoyer
        </label>
        <select
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
          className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {AUTOMATION_DELAYS.map((d) => (
            <option key={d.minutes} value={d.minutes}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="mb-3 text-[13px] text-muted-foreground">
          {atHour != null
            ? "Ignoré : c'est le jour et l'heure ci-dessous qui comptent."
            : delay === 0
              ? "Part au moment où le lead entre dans la colonne."
              : "Précision au quart d'heure : la file part toutes les ~5 min. L'envoi est annulé si le lead a quitté la colonne entre-temps."}
        </p>

        <label className="mb-1 block text-xs font-medium text-foreground">
          … ou à jour et heure fixes (heure de Tunis)
        </label>
        <div className="mb-1 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">J+</span>
          <input
            type="number"
            min={0}
            max={60}
            value={delayDays}
            onChange={(e) => setDelayDays(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <span className="text-muted-foreground">à</span>
          <select
            value={atHour ?? ""}
            onChange={(e) => setAtHour(e.target.value === "" ? null : Number(e.target.value))}
            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="">— pas d&apos;heure fixe —</option>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 text-[13px] text-muted-foreground">
          « J+3 à 18 h » = trois jours après l&apos;entrée, à 18 h. Un modèle WhatsApp
          marketing ne part jamais deux fois en 24 h vers la même personne.
        </p>

        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          Règle active
        </label>
        {automation?.pausedReason && !automation.active && (
          // Arrêt décidé par Meta, pas par l'équipe : dire pourquoi avant
          // qu'on ne réactive à l'aveugle.
          <p className="mb-4 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
            {automation.pausedReason} Vérifie le modèle chez Meta avant de réactiver.
          </p>
        )}

        </div>
        </div>

        <div className="px-5 pb-5 pt-3">
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            disabled={isPending || (canal === "email" ? !templateId : !waTemplate)}
            onClick={save}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            Enregistrer
          </button>
          {automation && (
            <button
              disabled={isPending}
              onClick={remove}
              className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50 dark:text-red-400"
            >
              Supprimer
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Retour
          </button>
        </div>
        </div>

      </div>
    </div>
  );
}
