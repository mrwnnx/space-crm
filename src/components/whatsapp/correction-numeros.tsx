"use client";

import { useEffect, useState, useTransition } from "react";
import { updateLeadFieldAction } from "@/app/actions";
import { remarqueNumeroAction } from "@/app/whatsapp-actions";

type Personne = { leadId: string; nom: string; numero: string | null; email: string | null };

/**
 * Les numéros écartés d'un envoi parce que Meta ne pourrait pas les joindre.
 * Un clic sur un nom : nom et téléphone modifiables, avec la remarque de
 * l'assistant (numéro probable, indicatif compris). Chaque correction refait
 * le décompte de l'envoi : la personne y revient si le numéro est bon.
 */
export function CorrectionNumeros({
  liste,
  onClose,
  onCorrige,
}: {
  liste: Personne[];
  onClose: () => void;
  onCorrige: () => void;
}) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [faits, setFaits] = useState<string[]>([]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-heading text-sm font-semibold text-foreground">Numéros à corriger</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Meta ne pourrait pas joindre ces numéros. Corrigez-les : ils reviennent dans l&apos;envoi.
          </p>
        </div>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {liste.map((p) => (
            <li key={p.leadId} className="px-5 py-2.5">
              <button
                type="button"
                onClick={() => setOuvert(ouvert === p.leadId ? null : p.leadId)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-sm font-medium text-foreground">
                  {faits.includes(p.leadId) && <span className="mr-1 text-green-600">✓</span>}
                  {p.nom}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{p.numero ?? "sans numéro"}</span>
              </button>
              {ouvert === p.leadId && (
                <Editeur
                  p={p}
                  onEnregistre={() => {
                    setFaits((f) => [...f, p.leadId]);
                    setOuvert(null);
                    onCorrige();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Editeur({ p, onEnregistre }: { p: Personne; onEnregistre: () => void }) {
  const [nom, setNom] = useState(p.nom);
  const [numero, setNumero] = useState(p.numero ?? "");
  const [remarque, setRemarque] = useState<{ texte: string; propose: string | null } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // La remarque arrive d'elle-même à l'ouverture de la personne.
  useEffect(() => {
    let vivant = true;
    remarqueNumeroAction(p.leadId).then((r) => {
      if (!vivant) return;
      if (r.ok) setRemarque({ texte: r.remarque, propose: r.numeroPropose });
      else setErreur(r.error);
    });
    return () => {
      vivant = false;
    };
  }, [p.leadId]);

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      if (nom.trim() && nom.trim() !== p.nom) await updateLeadFieldAction(p.leadId, "fullName", nom.trim());
      if (numero.trim() !== (p.numero ?? "")) await updateLeadFieldAction(p.leadId, "mobileNo", numero.trim());
      onEnregistre();
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-muted/40 p-3">
      <label className="block">
        <span className="mb-0.5 block text-[12px] text-muted-foreground">Nom</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[12px] text-muted-foreground">Téléphone (avec l&apos;indicatif du pays)</span>
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          inputMode="tel"
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm outline-none focus:border-ring"
        />
      </label>

      <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-[12.5px] text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200">
        {remarque ? (
          <>
            <p>✨ {remarque.texte}</p>
            {remarque.propose && remarque.propose !== numero.replace(/\D/g, "") && (
              <button
                type="button"
                onClick={() => setNumero(remarque.propose!)}
                className="mt-1.5 rounded-md bg-violet-600 px-2 py-0.5 text-[12px] font-medium text-white hover:bg-violet-700"
              >
                Utiliser {remarque.propose}
              </button>
            )}
          </>
        ) : (
          <p className="text-violet-700/80 dark:text-violet-300/80">✨ L&apos;assistant regarde le numéro…</p>
        )}
      </div>

      {erreur && <p className="text-[12.5px] text-red-600">{erreur}</p>}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={enregistrer}
          disabled={isPending || !numero.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
