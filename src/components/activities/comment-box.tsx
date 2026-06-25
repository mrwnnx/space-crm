"use client";

import { useState, useTransition } from "react";
import { addCommentAction } from "@/app/actions";

export function CommentBox({
  referenceType,
  referenceId,
  onClose,
}: {
  referenceType: "lead" | "deal" | "contact" | "organization";
  referenceId: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      await addCommentAction(referenceType, referenceId, content);
      setContent("");
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Votre commentaire..."
        rows={3}
        autoFocus
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          Annuler
        </button>
        <button type="submit" disabled={isPending || !content.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? "..." : "Commenter"}
        </button>
      </div>
    </form>
  );
}
