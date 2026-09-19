"use client";

import { checkCampaign, type Check } from "@/lib/campaigns/preflight";

/**
 * Contrôles affichés PENDANT l'écriture — l'idée reprise de Kit.
 *
 * Le composant recalcule à chaque frappe à partir du même module que le
 * serveur : ce qui s'affiche ici est exactement ce qui bloquera l'envoi.
 */
export function CampaignPreflight({
  subject,
  content,
}: {
  subject: string;
  content: string;
}) {
  const checks = checkCampaign({ subject, content });
  const problems = checks.filter((c) => c.level !== "tip");
  const tips = checks.filter((c) => c.level === "tip");

  return (
    <div className="space-y-1.5">
      {problems.length === 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          <span aria-hidden>✓</span> Rien ne bloque l&apos;envoi.
        </p>
      )}
      {problems.map((c) => (
        <CheckRow key={c.id} check={c} />
      ))}
      {tips.length > 0 ? (
        <>
          <p className="pt-1 text-[11px] text-muted-foreground">
            Pour arriver en <strong>Principale</strong>{" "}plutôt qu&apos;en Promotions — mesuré
            sur nos propres envois, pas des règles générales :
          </p>
          {tips.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
          <span aria-hidden>✓</span> Objet et texte ont le profil des emails arrivés en Principale.
        </p>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const style =
    check.level === "error"
      ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
      : check.level === "warning"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        : "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400";
  const label =
    check.level === "error" ? "Bloquant" : check.level === "warning" ? "À vérifier" : "Conseil";
  const icon = check.level === "error" ? "✕" : check.level === "warning" ? "!" : "→";
  return (
    <p className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${style}`}>
      <span aria-hidden className="shrink-0 leading-4">
        {icon}
      </span>
      <span>
        <strong className="font-semibold">{label}</strong>
        {" — "}
        {check.message}
      </span>
    </p>
  );
}
