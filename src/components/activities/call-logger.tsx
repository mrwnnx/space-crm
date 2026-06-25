"use client";

import { useState, useTransition } from "react";
import { logCallAction } from "@/app/actions";

export function CallLogger({
  referenceType,
  referenceId,
  onClose,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  onClose: () => void;
}) {
  const [type, setType] = useState<"incoming" | "outgoing">("outgoing");
  const [duration, setDuration] = useState(0);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.set("type", type);
    formData.set("duration", String(duration));
    formData.set("notes", notes);
    formData.set("status", "completed");
    startTransition(async () => {
      await logCallAction(referenceType, referenceId, formData);
      setNotes("");
      setDuration(0);
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["outgoing", "incoming"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              type === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "outgoing" ? "Sortant" : "Entrant"}
          </button>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Durée (secondes)
        </label>
        <input
          type="number"
          min="0"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Notes d'appel..."
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          Annuler
        </button>
        <button type="submit" disabled={isPending} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? "..." : "Logger l'appel"}
        </button>
      </div>
    </form>
  );
}
