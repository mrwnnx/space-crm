"use client";

import { useState, useTransition } from "react";
import { inviteCollaboratorAction, removeAllowedEmailAction } from "@/app/actions";
import { formatDate, formatRelative } from "@/lib/utils";
import type { TeamMember } from "@/lib/queries";

export function TeamManager({ emails }: { emails: TeamMember[] }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const formData = new FormData();
    formData.set("email", email);
    formData.set("note", note);
    startTransition(async () => {
      const res = await inviteCollaboratorAction(formData);
      setResult(res);
      if (res.ok) {
        setEmail("");
        setNote("");
      }
    });
  }

  const actifs = emails.filter((e) => e.active).length;
  const attente = emails.length - actifs;

  return (
    <div className="space-y-6">
      {/* Le décompte AVANT la liste : « combien j'en ai invité, et combien
          sont réellement entrés » est la question qu'on se pose en arrivant. */}
      {emails.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            <strong className="text-foreground tabular-nums">{emails.length}</strong>{" "}
            {emails.length > 1 ? "adresses invitées" : "adresse invitée"}
          </span>
          <span className="text-emerald-700 dark:text-emerald-400">
            <strong className="tabular-nums">{actifs}</strong> actif{actifs > 1 ? "s" : ""}
          </span>
          {attente > 0 && (
            <span className="text-amber-700 dark:text-amber-500">
              <strong className="tabular-nums">{attente}</strong> sans compte
            </span>
          )}
        </div>
      )}

      {attente > 0 && (
        // Dit CE QU'IL FAUT FAIRE, pas seulement ce qui manque : ces
        // personnes ne peuvent pas « mot de passe oublié », il n'y a rien à
        // réinitialiser. Elles doivent créer leur compte.
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-400">
          {attente === 1 ? "Une adresse invitée n'a" : `${attente} adresses invitées n'ont`}{" "}
          pas encore de compte. Tant qu&apos;{attente === 1 ? "elle ne l'a" : "elles ne l'ont"}{" "}
          pas créé depuis l&apos;écran de connexion, «&nbsp;mot de passe oublié&nbsp;» ne leur
          enverra rien — il n&apos;y a pas de mot de passe à réinitialiser.
        </p>
      )}

      {/* Collaborateurs autorisés */}
      <div className="space-y-2">
        {emails.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Aucun collaborateur autorisé. Invitez-en un ci-dessous.
          </p>
        ) : (
          emails.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{row.email}</p>
                  <span
                    title={
                      row.active
                        ? "Un compte existe pour cette adresse"
                        : "Invitée, mais aucun compte créé à ce jour"
                    }
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                      row.active
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {row.active ? "Actif" : "Sans compte"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.note ? `${row.note} — ` : ""}
                  autorisé le {formatDate(row.createdAt)}
                  {row.active && ` · dernière connexion ${formatRelative(row.lastSignInAt)}`}
                </p>
              </div>
              <button
                onClick={() => startTransition(() => removeAllowedEmailAction(row.id))}
                className="ml-3 shrink-0 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
              >
                Retirer
              </button>
            </div>
          ))
        )}
      </div>

      {/* Invitation */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground font-heading">
          Inviter un collaborateur
        </h3>
        <form onSubmit={invite} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Email *
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              placeholder="prenom@thespace.academy"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Note (optionnel)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Sarah — community manager"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Envoi..." : "Envoyer l'invitation"}
          </button>

          {result && (
            <p
              className={
                result.ok
                  ? "text-xs text-green-600 dark:text-green-400"
                  : "text-xs text-red-600 dark:text-red-400"
              }
            >
              {result.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
