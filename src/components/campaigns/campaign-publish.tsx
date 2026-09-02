"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CampaignAudience } from "./campaign-audience";
import { CampaignSend } from "./campaign-send";
import { saveCampaignNoteAction } from "@/app/(dashboard)/campaigns/actions";
import type { RecipientRow } from "@/lib/campaigns/queries";

type Tag = { id: string; name: string; leadCount: number };

/**
 * Étape 2 — « Publier ». Reprise de la logique de Kit :
 *
 * L'envoi n'est JAMAIS un état par défaut. La case du canal arrive décochée,
 * et tant qu'elle l'est, ni l'expéditeur, ni la cible, ni le bouton d'envoi
 * n'existent à l'écran. Il faut un geste positif pour armer le canal.
 *
 * Kit propose deux canaux (email, page publique). Ici il n'y en a qu'un — la
 * case reste, parce que c'est elle qui porte le geste, pas le choix.
 */
export function CampaignPublish({
  campaignId,
  status,
  tags,
  initialTagIds,
  initialEmails,
  initialNote,
  recipients,
  recipientCount,
  canSend,
  blocking,
  from,
}: {
  campaignId: string;
  status: string;
  tags: Tag[];
  initialTagIds: string[];
  initialEmails: string[];
  initialNote: string;
  recipients: RecipientRow[];
  recipientCount: number;
  canSend: boolean;
  /** Messages des contrôles bloquants — l'envoi reste fermé tant qu'il y en a. */
  blocking: string[];
  from: string;
}) {
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [noteSaved, setNoteSaved] = useState(true);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enregistrement différé : sans ça, une note de 30 caractères déclenchait 30
  // appels serveur, et deux réponses arrivées dans le désordre pouvaient
  // réécrire une frappe plus récente par une plus ancienne.
  function saveNote(value: string) {
    setNote(value);
    setNoteSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        await saveCampaignNoteAction(campaignId, value);
        setNoteSaved(true);
      });
    }, 600);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-foreground font-heading">
          Publier la campagne
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choisissez où vous voulez publier cette campagne.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-sm font-medium text-foreground">
            Envoyer par email
          </span>
          <input
            type="checkbox"
            checked={armed}
            onChange={(e) => setArmed(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-border"
          />
        </label>

        {armed && (
          <div className="space-y-5 border-t border-border px-4 py-4">
            <Field label="Expéditeur">
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {from}
              </p>
            </Field>

            <Field label="À qui l'envoyer ?">
              <CampaignAudience
                campaignId={campaignId}
                tags={tags}
                initialTagIds={initialTagIds}
                initialEmails={initialEmails}
                readOnly={status !== "draft"}
              />
            </Field>

            <Field label="Quand ?">
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Maintenant — l&apos;envoi part au clic, il n&apos;y a pas de planification.
              </p>
            </Field>

            <details className="group">
              <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground">
                Options avancées
              </summary>
              <div className="mt-3">
                <Field label="Note interne">
                  <textarea
                    value={note}
                    onChange={(e) => saveNote(e.target.value)}
                    rows={2}
                    placeholder="Visible seulement par l'équipe. Affichée sous l'objet dans la liste."
                    className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {noteSaved ? "Enregistrée." : "Enregistrement…"} Elle ne part jamais
                    dans l&apos;email.
                  </p>
                </Field>
              </div>
            </details>

            {blocking.length > 0 ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                  L&apos;envoi est bloqué
                </p>
                <ul className="mt-1 space-y-0.5">
                  {blocking.map((m) => (
                    <li key={m} className="text-xs text-red-700 dark:text-red-400">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <CampaignSend
                campaignId={campaignId}
                status={status}
                recipients={recipients}
                canSend={canSend}
                recipientCount={recipientCount}
              />
            )}
          </div>
        )}
      </div>

      {!armed && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Rien ne part tant que vous n&apos;avez pas coché un canal.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
