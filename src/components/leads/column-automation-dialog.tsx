"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  saveColumnAutomationAction,
  deleteColumnAutomationAction,
} from "@/app/actions";
import { AUTOMATION_DELAYS } from "@/lib/automation-delays";

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

export function ColumnAutomationDialog({
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
  const [delay, setDelay] = useState(automation?.delayMinutes ?? 0);
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
          : undefined
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
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
          Automatiser « {columnName} »
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Chaque lead qui entre dans cette colonne reçoit ce message — <strong>une seule
          fois</strong>, quel que soit le chemin&nbsp;: glisser-déposer, inscription, ou
          import du site.
        </p>

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
                Nom du modèle approuvé par Meta
              </label>
              <input
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value.toLowerCase())}
                placeholder="brochure_programme"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Minuscules, chiffres et underscores uniquement. Le modèle doit exister et être
                approuvé dans le WhatsApp Manager — sinon l&apos;envoi échoue au premier lead.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Langue</label>
              <input
                value={waLangue}
                onChange={(e) => setWaLangue(e.target.value)}
                placeholder="fr"
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
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
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
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
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Meta ne connaît pas les noms : ses modèles portent{" "}
                <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… C&apos;est l&apos;ordre de
                sélection qui fait la correspondance. Clique pour ajouter ou retirer.
              </p>
            </div>

            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-500">
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
            <p className="mb-3 text-[11px] text-muted-foreground">
              <Link href="/settings?tab=emails" className="text-primary underline">
                Créer ou modifier un modèle
              </Link>
            </p>
          </>
        )}

        </>
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
        <p className="mb-3 text-[11px] text-muted-foreground">
          {delay === 0
            ? "Part au moment où le lead entre dans la colonne."
            : "Précision au quart d'heure : la file part toutes les ~15 min. L'envoi est annulé si le lead a quitté la colonne entre-temps."}
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

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            disabled={isPending || !templateId}
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
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
