"use client";

import { useState, useTransition } from "react";
import { inviteCollaboratorAction, removeAllowedEmailAction } from "@/app/actions";
import { formatDate } from "@/lib/utils";
import type { AllowedEmail } from "@/db/schema";

export function TeamManager({ emails }: { emails: AllowedEmail[] }) {
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

  return (
    <div className="space-y-6">
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
                <p className="truncate text-sm font-medium text-foreground">{row.email}</p>
                <p className="text-xs text-muted-foreground">
                  {row.note ? `${row.note} — ` : ""}
                  autorisé le {formatDate(row.createdAt)}
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
