"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toggleLeadTagAction } from "@/app/actions";
import { statusColor } from "@/lib/utils";

type Tag = { id: string; name: string; color: string };

/**
 * Les tags de la fiche : seuls ceux qui sont POSÉS s'affichent (un clic les
 * retire), et un « + » ouvre la liste des autres pour en ajouter. Avant, les
 * 30 tags du compte s'affichaient tous, posés ou non — la fiche était
 * illisible et l'information (lesquels sont actifs) se perdait dans la masse.
 */
export function LeadTags({
  leadId,
  allTags,
  tagIds,
}: {
  leadId: string;
  allTags: Tag[];
  tagIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(tagIds);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  // Le menu se ferme au clic dehors.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(tag: Tag) {
    const on = !selected.includes(tag.id);
    // Optimiste : la pastille réagit tout de suite, l'action suit.
    setSelected((prev) => (on ? [...prev, tag.id] : prev.filter((x) => x !== tag.id)));
    startTransition(async () => {
      await toggleLeadTagAction(leadId, tag.id, on);
    });
  }

  const actifs = allTags.filter((t) => selected.includes(t.id));
  const disponibles = allTags.filter((t) => !selected.includes(t.id));

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tags
      </p>

      {allTags.length === 0 ? (
        <p className="text-[13px] text-muted-foreground/70">
          Aucun tag créé.{" "}
          <Link href="/tags" className="underline hover:text-foreground">
            En créer un
          </Link>
        </p>
      ) : (
        <div className="relative flex flex-wrap items-center gap-1" ref={menuRef}>
          {actifs.map((tag) => {
            const sc = statusColor(tag.color);
            return (
              <button
                key={tag.id}
                onClick={() => toggle(tag)}
                disabled={isPending}
                title={`Retirer « ${tag.name} »`}
                className={`group inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium transition-opacity disabled:opacity-60 ${sc.bg} ${sc.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {tag.name}
                <span className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden>
                  ×
                </span>
              </button>
            );
          })}

          {disponibles.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label="Ajouter un tag"
              aria-expanded={open}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[15px] leading-none text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:bg-muted hover:text-foreground"
            >
              +
            </button>
          )}

          {open && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
              {disponibles.map((tag) => {
                const sc = statusColor(tag.color);
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      toggle(tag);
                      setOpen(false);
                    }}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${sc.dot}`} />
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
