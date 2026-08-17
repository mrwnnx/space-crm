import type { CampaignStats } from "@/lib/campaigns/analytics";

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-green-700"
      : tone === "bad"
        ? "text-red-600"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CampaignStatsPanel({
  stats,
  currency = "TND",
}: {
  stats: CampaignStats;
  currency?: string;
}) {
  const nothingSent = stats.sent === 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric
          label="Envoyés"
          value={String(stats.sent)}
          hint={
            stats.recipients !== stats.sent
              ? `sur ${stats.recipients} destinataires`
              : undefined
          }
        />
        <Metric
          label="Délivrés"
          value={String(stats.delivered)}
          hint={
            stats.delivered === 0 && stats.sent > 0
              ? "en attente de confirmation"
              : undefined
          }
        />
        <Metric
          label="Rebonds"
          value={String(stats.bounced)}
          hint={nothingSent ? undefined : `${stats.bounceRate}%`}
          tone={stats.bounced > 0 ? "bad" : "neutral"}
        />
        <Metric
          label="Ouvertures"
          value={nothingSent ? "—" : `${stats.openRate}%`}
          hint={`${stats.opened} personne${stats.opened > 1 ? "s" : ""}`}
        />
        <Metric
          label="Clics"
          value={nothingSent ? "—" : `${stats.clickRate}%`}
          hint={`${stats.clicked} personne${stats.clicked > 1 ? "s" : ""}`}
        />
        <Metric
          label="Revenu attribué"
          value={
            stats.revenue > 0
              ? `${stats.revenue.toLocaleString("fr-FR")} ${currency}`
              : "—"
          }
          hint={
            stats.conversions > 0
              ? `${stats.conversions} inscription${stats.conversions > 1 ? "s" : ""}`
              : "aucune inscription attribuée"
          }
          tone={stats.revenue > 0 ? "good" : "neutral"}
        />
      </div>

      {(stats.complained > 0 || stats.skipped > 0 || stats.failed > 0) && (
        <p className="text-xs text-muted-foreground">
          {[
            stats.complained > 0 && `${stats.complained} plainte${stats.complained > 1 ? "s" : ""} pour spam`,
            stats.failed > 0 && `${stats.failed} échec${stats.failed > 1 ? "s" : ""} d'envoi`,
            stats.skipped > 0 && `${stats.skipped} ignoré${stats.skipped > 1 ? "s" : ""}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Le taux d&apos;ouverture est structurellement gonflé&nbsp;: Apple Mail
        précharge les images sans que personne n&apos;ait lu. Le taux de clic,
        lui, est fiable. Le revenu est attribué à la dernière campagne reçue
        dans les 30&nbsp;jours précédant l&apos;inscription.
      </p>
    </div>
  );
}
