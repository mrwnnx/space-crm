"use client";

import { useEffect, useState, useTransition } from "react";
import {
  previewAudienceAction,
  saveCampaignTargetAction,
} from "@/app/(dashboard)/campaigns/actions";

type Tag = { id: string; name: string; leadCount: number };

type Stats = {
  matched: number;
  unsubscribed: number;
  bounced: number;
  noEmail: number;
  duplicates: number;
  unknownEmails: number;
  total: number;
};

const parseEmails = (raw: string) =>
  raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);

export function CampaignAudience({
  campaignId,
  tags,
  initialTagIds,
  initialEmails,
  readOnly,
}: {
  campaignId: string;
  tags: Tag[];
  initialTagIds: string[];
  initialEmails: string[];
  readOnly: boolean;
}) {
  const [tagIds, setTagIds] = useState<string[]>(initialTagIds);
  const [emailsRaw, setEmailsRaw] = useState(initialEmails.join("\n"));
  const [stats, setStats] = useState<Stats | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Recalcul différé : sans ce délai, chaque frappe dans la zone d'adresses
  // déclencherait une requête.
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await previewAudienceAction(tagIds, parseEmails(emailsRaw));
        setStats(r.stats);
        setIgnored(r.ignoredEmails);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [tagIds, emailsRaw]);

  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [saved]);

  function toggleTag(id: string) {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveCampaignTargetAction(
        campaignId,
        tagIds,
        parseEmails(emailsRaw)
      );
      if (r.ok) setSaved(true);
      else setError(r.error);
    });
  }

  const excluded = stats
    ? [
        stats.unsubscribed > 0 && `${stats.unsubscribed} désabonné${stats.unsubscribed > 1 ? "s" : ""}`,
        stats.bounced > 0 && `${stats.bounced} adresse${stats.bounced > 1 ? "s" : ""} invalide${stats.bounced > 1 ? "s" : ""}`,
        stats.noEmail > 0 && `${stats.noEmail} sans adresse`,
        stats.duplicates > 0 && `${stats.duplicates} en double`,
        stats.unknownEmails > 0 && `${stats.unknownEmails} hors CRM`,
      ].filter(Boolean)
    : [];

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Tags ciblés
        </label>
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun tag.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => toggleTag(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition disabled:opacity-60 ${
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  }`}
                >
                  {t.name}
                  <span className="ml-1.5 opacity-60">{t.leadCount}</span>
                </button>
              );
            })}
          </div>
        )}
        {tagIds.length > 1 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Union : un lead présent dans plusieurs tags cochés ne reçoit
            qu&apos;un seul email.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Adresses supplémentaires
        </label>
        <textarea
          value={emailsRaw}
          onChange={(e) => setEmailsRaw(e.target.value)}
          readOnly={readOnly}
          rows={3}
          placeholder="Une adresse par ligne — elles doivent déjà exister dans le CRM"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 read-only:bg-muted"
        />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        {loading || !stats ? (
          <p className="text-sm text-muted-foreground">Calcul…</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {stats.total} destinataire{stats.total > 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.matched} trouvé{stats.matched > 1 ? "s" : ""}
              {excluded.length > 0 && ` — ${excluded.join(", ")}`}
            </p>
            {ignored.length > 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Ignorées, absentes du CRM : {ignored.join(", ")}. Créez-les comme
                leads pour pouvoir les toucher.
              </p>
            )}
          </>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer la cible"}
          </button>
          {saved && <span className="text-xs text-green-600">Enregistré</span>}
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
