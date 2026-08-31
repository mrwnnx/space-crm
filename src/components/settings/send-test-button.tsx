"use client";

import { useState, useTransition } from "react";
import { sendTestEmailAction } from "@/app/actions";

/**
 * Envoie le contenu EN COURS D'ÉDITION, pas la version enregistrée : sinon il
 * faudrait sauvegarder avant chaque essai. Le rendu passe par le même
 * convertisseur et le même habillage qu'un envoi réel.
 */
export function SendTestButton({
  subject,
  content,
  defaultTo,
  button,
}: {
  subject: string;
  content: string;
  defaultTo: string;
  /** Bouton principal en cours d'édition : le test doit l'embarquer aussi. */
  button?: { enabled: boolean; label: string; url: string; position: string };
}) {
  const [to, setTo] = useState(defaultTo);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setResult(null);
    startTransition(async () =>
      setResult(await sendTestEmailAction(to, subject, content, button))
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        type="email"
        placeholder="adresse de test"
        className="w-56 rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        onClick={send}
        disabled={isPending}
        className="rounded-md border border-border px-2 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
      >
        {isPending ? "Envoi…" : "Envoyer un test"}
      </button>
      {result && (
        <span
          className={result.ok ? "text-[11px] text-green-600" : "text-[11px] text-red-600"}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
