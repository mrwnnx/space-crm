"use client";

import { useState, useTransition } from "react";
import { inviteCollaboratorAction, removeAllowedEmailAction } from "@/app/actions";
import { formatDate, formatRelative } from "@/lib/utils";
import type { TeamMember } from "@/lib/queries";

export type OutsideAccount = {
  email: string;
  lastSignInAt: Date | null;
  createdAt: Date;
};

export function TeamManager({
  emails,
  outside = [],
}: {
  emails: TeamMember[];
  /** Comptes qui se connectent sans figurer dans la liste. */
  outside?: OutsideAccount[];
}) {
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
          {/* Le chiffre qui compte vraiment : combien de personnes peuvent
              ouvrir ce CRM, invitation ou pas. */}
          <span className="ml-auto text-muted-foreground">
            <strong className="text-foreground tabular-nums">
              {actifs + outside.length}
            </strong>{" "}
            {actifs + outside.length > 1 ? "personnes ont accès" : "personne a accès"}
          </span>
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

      {outside.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-2">
            <p className="text-xs font-semibold text-sky-900 dark:text-sky-300">
              {outside.length === 1
                ? "1 compte se connecte sans figurer dans cette liste"
                : `${outside.length} comptes se connectent sans figurer dans cette liste`}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-sky-800/80 dark:text-sky-300/70">
              La liste ci-dessus garde la porte de l&apos;<strong>inscription</strong>, pas
              celle de la <strong>connexion</strong>. Un compte créé avant elle, ou dont
              l&apos;adresse en a été retirée depuis, continue d&apos;entrer normalement.
              Pour lui couper l&apos;accès, il faut supprimer le compte depuis le tableau
              de bord Supabase — le retirer d&apos;ici n&apos;y changerait rien.
            </p>
          </div>

          {outside.map((a) => (
            <div
              key={a.email}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{a.email}</p>
                  <span
                    title="Compte actif, absent de la liste d'équipe"
                    className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-800"
                  >
                    Hors liste
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  compte créé le {formatDate(a.createdAt)} · dernière connexion{" "}
                  {formatRelative(a.lastSignInAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
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
