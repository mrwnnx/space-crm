"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon,
  Message01Icon,
  Call02Icon,
  Note02Icon,
  Comment01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { EmailComposer } from "@/components/activities/email-composer";
import { WhatsAppComposer } from "@/components/activities/whatsapp-composer";
import { CallLogger } from "@/components/activities/call-logger";
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

type Channel = "email" | "whatsapp" | "call" | "note" | "comment" | null;

const CHANNELS: { id: Channel; label: string; icon: typeof Mail01Icon }[] = [
  { id: "email", label: "Email", icon: Mail01Icon },
  { id: "whatsapp", label: "WhatsApp", icon: Message01Icon },
  { id: "call", label: "Call", icon: Call02Icon },
  { id: "note", label: "Note", icon: Note02Icon },
  { id: "comment", label: "Comment", icon: Comment01Icon },
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
  const [channel, setChannel] = useState<Channel>(null);

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

  return (
    <div className="flex h-full flex-col">
      {/* Channel selector bar */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch.id}
            onClick={() => setChannel(channel === ch.id ? null : ch.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              channel === ch.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HugeiconsIcon icon={ch.icon} size={14} />
            {ch.label}
          </button>
        ))}
      </div>

      {/* Composer (conditional) */}
      {channel && (
        <div className="border-b border-border bg-muted/20 p-4">
          {channel === "email" && (
            <EmailComposer
              referenceType={referenceType}
              referenceId={referenceId}
              to={leadEmail || ""}
              templates={templates}
              onClose={() => setChannel(null)}
            />
          )}
          {channel === "whatsapp" && (
            <WhatsAppComposer
              referenceType={referenceType}
              referenceId={referenceId}
              to={leadWhatsapp || leadMobile || ""}
              onClose={() => setChannel(null)}
            />
          )}
          {channel === "call" && (
            <CallLogger
              referenceType={referenceType}
              referenceId={referenceId}
              onClose={() => setChannel(null)}
            />
          )}
          {channel === "note" && (
            <QuickNoteBox
              referenceType={referenceType}
              referenceId={referenceId}
              onClose={() => setChannel(null)}
            />
          )}
          {channel === "comment" && (
            <CommentBox
              referenceType={referenceType}
              referenceId={referenceId}
              onClose={() => setChannel(null)}
            />
          )}
        </div>
      )}

      {/* Timeline */}
      <ActivityTimeline activities={timeline} />
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
