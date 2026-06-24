"use client";

import { useState, useTransition } from "react";
import { addLeadNote } from "@/app/actions";
import { cn, formatRelative } from "@/lib/utils";

type Activity = {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  createdAt: string;
};

const TYPE_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  email: { icon: "✉", color: "text-blue-600", bg: "bg-blue-50" },
  whatsapp: { icon: "💬", color: "text-green-600", bg: "bg-green-50" },
  sms: { icon: "📱", color: "text-purple-600", bg: "bg-purple-50" },
  note: { icon: "📝", color: "text-amber-600", bg: "bg-amber-50" },
  call: { icon: "📞", color: "text-indigo-600", bg: "bg-indigo-50" },
  status_change: { icon: "↻", color: "text-slate-600", bg: "bg-slate-50" },
  webhook_in: { icon: "⚡", color: "text-orange-600", bg: "bg-orange-50" },
};

export function ActivityFeed({
  leadId,
  activities,
}: {
  leadId: string;
  activities: Activity[];
}) {
  const [quickNote, setQuickNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleQuickNote(e: React.FormEvent) {
    e.preventDefault();
    if (!quickNote.trim()) return;
    startTransition(async () => {
      await addLeadNote(leadId, quickNote);
      setQuickNote("");
    });
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-700">
          Historique ({activities.length})
        </h2>
      </div>

      <div className="border-b border-slate-200 p-4">
        <form onSubmit={handleQuickNote} className="flex gap-2">
          <input
            type="text"
            value={quickNote}
            onChange={(e) => setQuickNote(e.target.value)}
            placeholder="Note rapide..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="submit"
            disabled={isPending || !quickNote.trim()}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "..." : "+"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-4">
          {activities.map((activity, i) => {
            const config = TYPE_CONFIG[activity.type] ?? TYPE_CONFIG.note;
            const isInbound = activity.direction === "inbound";

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
                    <div className="mt-1 w-px flex-1 bg-slate-200" />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {activity.subject ?? activity.type}
                    </span>
                    {isInbound && (
                      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-600">
                        Reçu
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400">
                      {formatRelative(activity.createdAt)}
                    </span>
                  </div>
                  {activity.content && (
                    <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      {activity.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              Aucune activité enregistrée
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
