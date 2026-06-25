"use client";

import { useState, useTransition } from "react";
import { addDealNoteAction } from "@/app/actions";
import { cn, formatRelative } from "@/lib/utils";

type Activity = {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  note: { icon: "📝", color: "text-amber-600", bg: "bg-amber-50" },
  status_change: { icon: "↻", color: "text-gray-600", bg: "bg-gray-50" },
  email: { icon: "✉", color: "text-blue-600", bg: "bg-blue-50" },
  call: { icon: "📞", color: "text-indigo-600", bg: "bg-indigo-50" },
  whatsapp: { icon: "💬", color: "text-green-600", bg: "bg-green-50" },
  comment: { icon: "💬", color: "text-gray-600", bg: "bg-gray-50" },
};

export function DealActivities({
  dealId,
  activities,
}: {
  dealId: string;
  activities: Activity[];
}) {
  const [quickNote, setQuickNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleQuickNote(e: React.FormEvent) {
    e.preventDefault();
    if (!quickNote.trim()) return;
    startTransition(async () => {
      await addDealNoteAction(dealId, quickNote);
      setQuickNote("");
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <form onSubmit={handleQuickNote} className="flex gap-2">
          <input
            type="text"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Ajouter une note..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button
            type="submit"
            disabled={isPending || !quickNote.trim()}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "..." : "+"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          {activities.map((activity, i) => {
            const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.note;

            return (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm",
                      config.bg,
                      config.color
                    )}
                  >
                    {config.icon}
                  </div>
                  {i < activities.length - 1 && (
                    <div className="mt-1 w-px flex-1 bg-border" />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {activity.subject ?? activity.type}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/70">
                      {formatRelative(activity.createdAt)}
                    </span>
                  </div>
                  {activity.content && (
                    <p className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {activity.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground/70">
              Aucune activité enregistrée
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
