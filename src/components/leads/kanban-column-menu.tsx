"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  renameStageAction,
  deleteStageAction,
  setStageKindAction,
  createStageAction,
} from "@/app/actions";

type ActionResult = { error?: string } | { ok?: boolean; warning?: string };

const menuItemCls =
  "block w-full px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted";

export function ColumnMenu({
  bootcampId,
  statusId,
  name,
  kind,
}: {
  bootcampId: string;
  statusId: string;
  name: string;
  kind: "normal" | "converted" | "lost";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isTerminal = kind === "converted" || kind === "lost";

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setRenaming(false);
      router.refresh();
    });
  }

  function close() {
    setOpen(false);
    setRenaming(false);
    setError(null);
    setValue(name);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Options de la colonne"
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 top-6 z-50 w-52 rounded-lg border border-border bg-card py-1 shadow-lg">
            {renaming ? (
              <div className="px-2 py-1.5">
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      run(() => renameStageAction(bootcampId, statusId, value));
                  }}
                  autoFocus
                  className="w-full rounded border border-ring bg-background px-2 py-1 text-xs outline-none"
                />
                <div className="mt-1 flex gap-1">
                  <button
                    disabled={isPending}
                    onClick={() =>
                      run(() => renameStageAction(bootcampId, statusId, value))
                    }
                    className="flex-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setRenaming(false)}
                    className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className={menuItemCls}
                  onClick={() => {
                    setValue(name);
                    setRenaming(true);
                  }}
                >
                  Renommer
                </button>

                {/* Désignation : seulement depuis une colonne NORMALE.
                    Promouvoir une colonne rétrograde l'ancienne → toujours 1 de chaque.
                    Les colonnes terminales sont rename-only (invariant préservé). */}
                {kind !== "converted" && !isTerminal && (
                  <button
                    className={menuItemCls}
                    onClick={() =>
                      run(() => setStageKindAction(bootcampId, statusId, "converted"))
                    }
                  >
                    Désigner comme Converti
                  </button>
                )}
                {kind !== "lost" && !isTerminal && (
                  <button
                    className={menuItemCls}
                    onClick={() =>
                      run(() => setStageKindAction(bootcampId, statusId, "lost"))
                    }
                  >
                    Désigner comme Perdu
                  </button>
                )}

                {!isTerminal && (
                  <button
                    className={`${menuItemCls} text-red-600 hover:bg-red-50`}
                    onClick={() =>
                      run(() => deleteStageAction(bootcampId, statusId))
                    }
                  >
                    Supprimer
                  </button>
                )}
              </>
            )}

            {error && (
              <p className="px-3 py-1.5 text-[10px] font-medium text-red-600">
                {error}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AddColumnButton({ bootcampId }: { bootcampId: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("Nouvelle colonne");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await createStageAction(bootcampId, value);
      setAdding(false);
      setValue("Nouvelle colonne");
      router.refresh();
    });
  }

  if (!adding) {
    return (
      <button
        onClick={() => setAdding(true)}
        className="flex h-9 w-56 shrink-0 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        + Ajouter une colonne
      </button>
    );
  }

  return (
    <div className="flex w-56 shrink-0 flex-col gap-1 rounded-lg border border-border bg-card p-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        autoFocus
        className="w-full rounded border border-ring bg-background px-2 py-1 text-xs outline-none"
      />
      <div className="flex gap-1">
        <button
          disabled={isPending}
          onClick={submit}
          className="flex-1 rounded bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Créer
        </button>
        <button
          onClick={() => setAdding(false)}
          className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
