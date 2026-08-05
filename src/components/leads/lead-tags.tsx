"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleLeadTagAction } from "@/app/actions";
import { statusColor } from "@/lib/utils";

type Tag = { id: string; name: string; color: string };

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
  const [isPending, startTransition] = useTransition();

  function toggle(tag: Tag) {
    const on = !selected.includes(tag.id);
    // Optimiste : la pastille réagit tout de suite, l'action suit.
    setSelected((prev) => (on ? [...prev, tag.id] : prev.filter((x) => x !== tag.id)));
    startTransition(async () => {
      await toggleLeadTagAction(leadId, tag.id, on);
    });
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Tags
      </p>

      {allTags.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70">
          Aucun tag créé.{" "}
          <Link href="/settings?tab=tags" className="underline hover:text-foreground">
            En créer un
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {allTags.map((tag) => {
            const on = selected.includes(tag.id);
            const sc = statusColor(tag.color);
            return (
              <button
                key={tag.id}
                onClick={() => toggle(tag)}
                disabled={isPending}
                title={on ? `Retirer « ${tag.name} »` : `Poser « ${tag.name} »`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity disabled:opacity-60 ${
                  on
                    ? `${sc.bg} ${sc.text}`
                    : "bg-transparent text-muted-foreground/50 ring-1 ring-inset ring-border hover:text-foreground"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? sc.dot : "bg-muted-foreground/30"}`} />
                {tag.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
