"use client";

import { useState, useTransition } from "react";
import { sendMessage, addLeadNote } from "@/app/actions";
import { cn } from "@/lib/utils";

type Tab = "email" | "whatsapp" | "sms" | "note";

export function LeadActions({ leadId }: { leadId: string }) {
  const [tab, setTab] = useState<Tab>("note");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setFeedback(null);

    startTransition(async () => {
      if (tab === "note") {
        await addLeadNote(leadId, content);
        setFeedback({ type: "success", msg: "Note ajoutée" });
      } else {
        const result = await sendMessage(
          leadId,
          tab,
          tab === "email" ? subject : null,
          content
        );
        if (result.ok) {
          setFeedback({
            type: "success",
            msg: `${tab.toUpperCase()} envoyé avec succès`,
          });
        } else {
          setFeedback({
            type: "error",
            msg: result.error ?? "Échec de l'envoi",
          });
        }
      }
      setSubject("");
      setContent("");
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "note", label: "Note" },
    { id: "email", label: "Email" },
    { id: "whatsapp", label: "WhatsApp" },
    { id: "sms", label: "SMS" },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setFeedback(null);
            }}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {tab === "email" && (
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Sujet"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            tab === "note"
              ? "Ajouter une note..."
              : `Votre message ${tab}...`
          }
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />

        {feedback && (
          <div
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              feedback.type === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            )}
          >
            {feedback.msg}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Envoi..."
            : tab === "note"
              ? "Ajouter la note"
              : `Envoyer ${tab}`}
        </button>
      </form>

      {tab !== "note" && (
        <p className="mt-3 text-xs text-slate-400">
          Le message sera envoyé via le provider configuré et enregistré dans
          l&apos;historique.
        </p>
      )}
    </div>
  );
}
