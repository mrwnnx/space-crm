"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { updateBootcampFieldAction, deleteBootcampAction } from "@/app/actions";

// Contrôle d'une formation SANS ouvrir sa page : statut, réglages, suppression.
// Le composant est un frère du <Link> de la carte (pas un enfant) : un clic ici
// ne déclenche donc jamais la navigation.

type Editable = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  capacity: number | null;
  currency: string;
  priceTotal: string | null;
  monthlyCount: number | null;
  monthlyAmount: string | null;
};

const STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "open", label: "Ouvert" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
];

export function BootcampCardMenu({
  bootcamp,
  canDelete,
}: {
  bootcamp: Editable;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Referme au clic extérieur — sinon le menu reste ouvert par-dessus les autres cartes.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function setStatus(value: string) {
    startTransition(async () => {
      await updateBootcampFieldAction(bootcamp.id, "status", value);
      setOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteBootcampAction(bootcamp.id);
      setShowDelete(false);
      router.refresh();
    });
  }

  // `updateBootcampFieldAction` transforme une valeur vide en NULL. Or name,
  // slug et currency sont NOT NULL en base : les envoyer vides ferait planter
  // la requête. On ne les transmet donc que s'ils ont une valeur.
  const NON_NULLABLE = new Set(["name", "slug", "currency"]);

  function saveSettings(formData: FormData) {
    startTransition(async () => {
      // Un appel par champ : l'action serveur valide champ par champ (whitelist).
      for (const field of [
        "name",
        "slug",
        "description",
        "startDate",
        "endDate",
        "capacity",
        "currency",
        "priceTotal",
        "monthlyCount",
        "monthlyAmount",
      ]) {
        const value = String(formData.get(field) ?? "").trim();
        if (!value && NON_NULLABLE.has(field)) continue;
        await updateBootcampFieldAction(bootcamp.id, field, value);
      }
      setShowSettings(false);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Actions pour ${bootcamp.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-52 rounded-lg border border-border bg-card p-1 shadow-lg">
          <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Statut
          </p>
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              disabled={isPending}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-40 ${
                bootcamp.status === s.value ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {s.label}
              {bootcamp.status === s.value && <span className="text-[10px]">●</span>}
            </button>
          ))}

          <div className="my-1 border-t border-border" />

          <button
            onClick={() => {
              setOpen(false);
              setShowSettings(true);
            }}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
          >
            Paramétrer…
          </button>

          <button
            onClick={() => {
              setOpen(false);
              if (canDelete) setShowDelete(true);
            }}
            disabled={!canDelete}
            title={canDelete ? undefined : "La formation par défaut ne peut pas être supprimée."}
            className="w-full rounded-md px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-muted-foreground/50 disabled:hover:bg-transparent"
          >
            Supprimer
          </button>
        </div>
      )}

      {showSettings && (
        <Modal title={`Paramétrer — ${bootcamp.name}`} onClose={() => setShowSettings(false)}>
          <form action={saveSettings} className="space-y-3">
            <Field label="Nom" name="name" defaultValue={bootcamp.name} required />
            <Field label="Slug (URL)" name="slug" defaultValue={bootcamp.slug} required />
            <Field
              label="Description"
              name="description"
              defaultValue={bootcamp.description ?? ""}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Date de début"
                name="startDate"
                type="date"
                defaultValue={bootcamp.startDate?.slice(0, 10) ?? ""}
              />
              <Field
                label="Date de fin"
                name="endDate"
                type="date"
                defaultValue={bootcamp.endDate?.slice(0, 10) ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Places"
                name="capacity"
                type="number"
                defaultValue={bootcamp.capacity != null ? String(bootcamp.capacity) : ""}
              />
              <Field label="Devise" name="currency" defaultValue={bootcamp.currency} required />
            </div>

            <div className="border-t border-border pt-3">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Offre &amp; paiement
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  label="Prix total"
                  name="priceTotal"
                  defaultValue={bootcamp.priceTotal ?? ""}
                />
                <Field
                  label="Nb mois"
                  name="monthlyCount"
                  type="number"
                  defaultValue={bootcamp.monthlyCount != null ? String(bootcamp.monthlyCount) : ""}
                />
                <Field
                  label="Par mois"
                  name="monthlyAmount"
                  defaultValue={bootcamp.monthlyAmount ?? ""}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
              >
                Annuler
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDelete && (
        <Modal title="Supprimer cette formation ?" onClose={() => setShowDelete(false)}>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{bootcamp.name}</strong> sera supprimée.
            Ses leads ne sont pas détruits : ils sont réaffectés à la formation par
            défaut. Les colonnes du pipeline de cette formation, elles, disparaissent.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={remove}
              disabled={isPending}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Suppression…" : "Supprimer"}
            </button>
            <button
              onClick={() => setShowDelete(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground"
            >
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-foreground font-heading">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
    </div>
  );
}
