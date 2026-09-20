"use client";

import { checkCampaign, type Check } from "@/lib/campaigns/preflight";

/** Un contrôle parle de l'objet ou du texte : il s'affiche sous le champ concerné. */
const isSubjectCheck = (id: string) => id.startsWith("subject-") || id.startsWith("tip-subject-");

/**
 * Contrôles affichés PENDANT l'écriture — l'idée reprise de Kit.
 *
 * Le composant recalcule à chaque frappe à partir du même module que le
 * serveur : ce qui s'affiche ici est exactement ce qui bloquera l'envoi.
 *
 * Monté deux fois : `scope="subject"` juste sous le champ objet, `scope="content"`
 * juste sous l'éditeur — le conseil arrive là où on est en train d'écrire
 * (demande de Marwen, 2026-09-19). Le bilan positif n'est dit qu'une fois, en bas.
 */
export function CampaignPreflight({
  subject,
  content,
  scope,
}: {
  subject: string;
  content: string;
  scope: "subject" | "content";
}) {
  const all = checkCampaign({ subject, content });
  const checks = all.filter((c) => isSubjectCheck(c.id) === (scope === "subject"));
  const problems = checks.filter((c) => c.level !== "tip");
  const tips = checks.filter((c) => c.level === "tip");

  if (scope === "subject") {
    if (checks.length === 0) return null;
    return (
      <div className="mt-1.5 space-y-1.5">
        {problems.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
        {tips.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </div>
    );
  }

  const allClean = all.length === 0;

  return (
    <div className="space-y-1.5">
      {problems.map((c) => (
        <CheckRow key={c.id} check={c} />
      ))}
      {tips.map((c) => (
        <CheckRow key={c.id} check={c} />
      ))}
      {allClean && (
        <p className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
          <span aria-hidden>✓</span> Rien ne bloque, et objet + texte ont le profil des emails
          arrivés en Principale.
        </p>
      )}
      {tips.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          Les conseils viennent de nos propres envois mesurés, pas de règles générales. Ils ne
          bloquent pas.
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
