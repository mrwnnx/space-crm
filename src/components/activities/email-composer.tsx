"use client";

import { useState, useTransition } from "react";
import { sendEmailAction } from "@/app/actions";
import type { EmailTemplate } from "@/db/schema";

export function EmailComposer({
  referenceType,
  referenceId,
  to,
  templates,
  onClose,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  to: string;
  templates: EmailTemplate[];
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) {
      setSubject(tpl.subject || subject);
      setContent(tpl.content);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !content.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await sendEmailAction(
        referenceType,
        referenceId,
        to,
        subject || "(sans sujet)",
        content,
        templateId || undefined
      );
      setFeedback(
        result.ok
          ? { ok: true, msg: "Email envoyé" }
          : { ok: false, msg: result.error || "Échec" }
      );
      if (result.ok) {
        setSubject("");
        setContent("");
        setTimeout(onClose, 1500);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">To:</span>
        <input
          value={to}
          readOnly
          className="flex-1 rounded-md bg-transparent px-1 text-xs text-foreground outline-none"
        />
        {templates.length > 0 && (
          <select
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
          >
            <option value="">Template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Sujet"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Votre message..."
        rows={5}
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
        <button type="submit" disabled={isPending || !to || !content.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? "Envoi..." : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
