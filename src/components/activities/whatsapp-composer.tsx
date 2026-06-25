"use client";

import { useState, useTransition } from "react";
import { sendWhatsAppAction } from "@/app/actions";

export function WhatsAppComposer({
  referenceType,
  referenceId,
  to,
  onClose,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  to: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !content.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await sendWhatsAppAction(referenceType, referenceId, to, content);
      setFeedback(
        result.ok
          ? { ok: true, msg: "WhatsApp envoyé" }
          : { ok: false, msg: result.error || "Échec" }
      );
      if (result.ok) {
        setContent("");
        setTimeout(onClose, 1500);
      }
    });
  }

  if (!to) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        Aucun numéro WhatsApp sur ce contact
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">To:</span>
        <span className="text-xs font-medium text-foreground">{to}</span>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Votre message WhatsApp..."
        rows={3}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      {feedback && (
        <p className={feedback.ok ? "text-xs text-green-600" : "text-xs text-red-600"}>
          {feedback.msg}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          Annuler
        </button>
        <button type="submit" disabled={isPending || !content.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
