import Link from "next/link";
import type { LeadCampaignRow } from "@/lib/campaigns/analytics";
import { formatDate } from "@/lib/utils";

const STATUS: Record<string, { text: string; className: string }> = {
  sent: { text: "Envoyé", className: "text-muted-foreground" },
  bounced: { text: "Rebond", className: "text-red-600" },
  complained: { text: "Plainte", className: "text-red-600" },
  failed: { text: "Échec", className: "text-red-600" },
  skipped: { text: "Ignoré", className: "text-amber-700" },
  pending: { text: "En attente", className: "text-muted-foreground" },
};

export function LeadCampaignHistory({ rows }: { rows: LeadCampaignRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="border-t border-border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Campagnes reçues ({rows.length})
      </p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const badge = STATUS[r.status] ?? STATUS.pending;
          return (
            <li key={r.campaignId}>
              <Link
                href={`/campaigns/${r.campaignId}`}
                className="block truncate text-xs font-medium text-foreground hover:underline"
              >
                {r.subject || r.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {r.sentAt ? formatDate(r.sentAt) : "—"}
                {" · "}
                <span className={badge.className}>{badge.text}</span>
                {/* L'engagement n'est affiché que s'il a eu lieu : « 0 ouverture »
                    sur un email non tracké induirait en erreur. */}
                {r.openedAt && " · ouvert"}
                {r.clickedAt && " · cliqué"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
