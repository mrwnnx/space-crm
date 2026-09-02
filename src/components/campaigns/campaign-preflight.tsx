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

  if (checks.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
        <span aria-hidden>✓</span> Rien à signaler avant l&apos;envoi.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.id}>
          <CheckRow check={c} />
        </li>
      ))}
    </ul>
  );
}

function CheckRow({ check }: { check: Check }) {
  const error = check.level === "error";
  return (
    <p
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
        error
          ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
          : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
      }`}
    >
      <span aria-hidden className="shrink-0 leading-4">
        {error ? "✕" : "!"}
      </span>
      <span>
        <strong className="font-semibold">{error ? "Bloquant" : "À vérifier"}</strong>
        {" — "}
        {check.message}
      </span>
    </p>
  );
}
