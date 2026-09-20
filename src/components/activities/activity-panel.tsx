"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Message01Icon,
  Call02Icon,
  Note02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { EmailComposer } from "@/components/activities/email-composer";
import { WhatsAppComposer } from "@/components/activities/whatsapp-composer";
import { CallLogger } from "@/components/activities/call-logger";
import { CallOutcomeForm } from "@/components/leads/call-outcome-form";
import { CommentBox } from "@/components/activities/comment-box";
import type { EmailTemplate } from "@/db/schema";

type Activity = {
  id: string;
  type: string;
  direction: string;
  subject: string | null;
  content: string | null;
  createdAt: string;
  createdBy?: string | null;
};

type Channel = "email" | "whatsapp" | "call" | "note";

// Un sous-onglet par canal : l'action qu'on peut faire, et l'historique de CE
// canal seulement — pas tout le fil mélangé (décision Marwen, 2026-09-20).
const CHANNELS: { id: Channel; label: string; icon: typeof Mail01Icon; types: string[]; vide: string }[] = [
  { id: "email", label: "Email", icon: Mail01Icon, types: ["email"], vide: "Aucun email échangé avec cette personne." },
  { id: "whatsapp", label: "WhatsApp", icon: Message01Icon, types: ["whatsapp"], vide: "Aucun message WhatsApp avec cette personne." },
  { id: "call", label: "Appel", icon: Call02Icon, types: ["call"], vide: "Aucun appel enregistré." },
  { id: "note", label: "Notes", icon: Note02Icon, types: ["note", "comment"], vide: "Aucune note." },
];

export function ActivityPanel({
  referenceType,
  referenceId,
  activities,
  comments: commentsData,
  leadEmail,
  leadMobile,
  leadWhatsapp,
  templates,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  activities: Activity[];
  comments: { id: string; content: string; createdBy: string | null; createdAt: string }[];
  leadEmail: string | null;
  leadMobile: string | null;
  leadWhatsapp: string | null;
  templates: EmailTemplate[];
}) {
  // WhatsApp d'abord quand il y a un numéro : c'est le canal du jour.
  const [channel, setChannel] = useState<Channel>(leadWhatsapp || leadMobile ? "whatsapp" : "email");
  // Après un envoi, le composeur se réinitialise (remontage) au lieu de se fermer.
  const [cle, setCle] = useState(0);
  const reset = () => setCle((k) => k + 1);

  // Merge activities + comments into unified timeline
  const timeline: Activity[] = [
    ...activities,
    ...commentsData.map((c) => ({
      id: c.id,
      type: "comment",
      direction: "outbound",
      subject: "Commentaire",
      content: c.content,
      createdAt: c.createdAt,
      createdBy: c.createdBy,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const actif = CHANNELS.find((c) => c.id === channel)!;
  const historique = timeline.filter((a) => actif.types.includes(a.type));
  const compte = (ch: (typeof CHANNELS)[number]) => timeline.filter((a) => ch.types.includes(a.type)).length;

  return (
    <div className="flex flex-col lg:h-full">
      {/* Sous-onglets par canal */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              channel === ch.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HugeiconsIcon icon={ch.icon} size={14} />
            {ch.label}
            {compte(ch) > 0 && <span className="text-[12px] opacity-70">{compte(ch)}</span>}
          </button>
        ))}
      </div>

      {/* L'action du canal, toujours ouverte */}
      <div className="border-b border-border bg-muted/20 p-4" key={cle}>
        {channel === "email" && (
          <EmailComposer
            referenceType={referenceType}
            referenceId={referenceId}
            to={leadEmail || ""}
            templates={templates}
            onClose={reset}
          />
        )}
        {channel === "whatsapp" && (
          <WhatsAppComposer
            referenceType={referenceType}
            referenceId={referenceId}
            to={leadWhatsapp || leadMobile || ""}
            onClose={reset}
          />
        )}
        {/* Sur un lead, le même formulaire que la file d'appels d'« Aujourd'hui » :
            ce qui s'est passé, la qualification, la durée, quand rappeler.
            Un deal garde le journal simple — logCallOutcomeAction n'écrit que
            sur des leads (qualification, prochaine relance). */}
        {channel === "call" &&
          (referenceType === "lead" ? (
            <CallOutcomeForm leadId={referenceId} onDone={reset} />
          ) : (
            <CallLogger referenceType={referenceType} referenceId={referenceId} onClose={reset} />
          ))}
        {channel === "note" && (
          <div className="space-y-3">
            <QuickNoteBox referenceType={referenceType} referenceId={referenceId} onClose={reset} />
            <CommentBox referenceType={referenceType} referenceId={referenceId} onClose={reset} />
          </div>
        )}
      </div>

      {/* L'historique de CE canal */}
      {historique.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{actif.vide}</p>
      ) : (
        <ActivityTimeline activities={historique} />
      )}
    </div>
  );
}

function QuickNoteBox({
  referenceType,
  referenceId,
  onClose,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    startTransition(async () => {
      if (referenceType === "lead") {
        const { addLeadNoteAction } = await import("@/app/actions");
        await addLeadNoteAction(referenceId, content);
      } else {
        const { addDealNoteAction } = await import("@/app/actions");
        await addDealNoteAction(referenceId, content);
      }
      setContent("");
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Votre note..."
        rows={3}
        autoFocus
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          Annuler
        </button>
        <button type="submit" disabled={isPending || !content.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {isPending ? "..." : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
