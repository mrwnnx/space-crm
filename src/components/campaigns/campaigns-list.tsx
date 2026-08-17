"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { CampaignRow } from "@/lib/campaigns/queries";
import {
  createCampaignAction,
  deleteCampaignAction,
  renameCampaignAction,
} from "@/app/(dashboard)/campaigns/actions";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  draft: { text: "Brouillon", className: "bg-muted text-muted-foreground" },
  scheduled: { text: "Programmée", className: "bg-blue-50 text-blue-700" },
  sending: { text: "Envoi en cours", className: "bg-amber-50 text-amber-700" },
  sent: { text: "Envoyée", className: "bg-green-50 text-green-700" },
  failed: { text: "Échec", className: "bg-red-50 text-red-700" },
};

export function CampaignsList({ campaigns }: { campaigns: CampaignRow[] }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name);
    setError(null);
    startTransition(async () => {
      const r = await createCampaignAction(fd);
      if (r.ok) {
        setName("");
        setCreating(false);
      } else setError(r.error);
    });
  }

  function submitRename(id: string) {
    startTransition(async () => {
      const r = await renameCampaignAction(id, editName);
      if (r.ok) setEditing(null);
      else setError(r.error);
    });
  }

  // Confirmation en ligne plutôt que confirm() natif : le dialogue du
  // navigateur gèle la page entière et bloque toute automatisation.
  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const r = await deleteCampaignAction(id);
      if (r.ok) setConfirmingDelete(null);
      else setError(r.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Un envoi groupé vers une cible choisie par tag. Les désabonnés en sont
          toujours exclus.
        </p>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Nouvelle campagne
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={submitNew} className="mb-4 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom interne — ex. Relance UXB août"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setName("");
            }}
            className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
          >
            Annuler
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Aucune campagne.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {campaigns.map((c) => {
            const badge = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {editing === c.id ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(c.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none"
                      />
                      <button
                        onClick={() => submitRename(c.id)}
                        className="text-xs text-foreground underline"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="block truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {c.name}
                    </Link>
                  )}
                  <p className="truncate text-xs text-muted-foreground">
                    {c.subject || "Sans sujet"}
                  </p>
                  {c.recipientCount > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.sentCount}/{c.recipientCount} envoyés
                      {c.openedCount > 0 && ` · ${c.openedCount} ouverture${c.openedCount > 1 ? "s" : ""}`}
                      {c.clickedCount > 0 && ` · ${c.clickedCount} clic${c.clickedCount > 1 ? "s" : ""}`}
                      {c.bouncedCount > 0 && (
                        <span className="text-red-600">
                          {" "}· {c.bouncedCount} rebond{c.bouncedCount > 1 ? "s" : ""}
                        </span>
                      )}
                      {c.failedCount > 0 && (
                        <span className="text-red-600">
                          {" "}· {c.failedCount} échec{c.failedCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}
                >
                  {badge.text}
                </span>

                {c.status === "draft" && editing !== c.id && (
                  <div className="flex shrink-0 items-center gap-2">
                    {confirmingDelete === c.id ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          Supprimer&nbsp;?
                        </span>
                        <button
                          onClick={() => remove(c.id)}
                          disabled={isPending}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          Oui
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(null)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditing(c.id);
                            setEditName(c.name);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Renommer
                        </button>
                        <button
                          onClick={() => setConfirmingDelete(c.id)}
                          className="text-xs text-muted-foreground hover:text-red-600"
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
