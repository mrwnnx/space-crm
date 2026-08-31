import "server-only";
import { db } from "@/db";
import { digestRuns, allowedEmails } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Digest quotidien : la file du jour, poussée par email.
 *
 * Le CRM sait désormais qui rappeler — encore faut-il que quelqu'un ouvre
 * l'écran. C'est le seul maillon qui restait.
 *
 * ⚠️ Idempotent par CONSTRUCTION : la date d'envoi est unique en base. Le cron
 * peut taper toutes les 15 minutes, un seul envoi passera.
 */

// La Tunisie est à UTC+1 toute l'année (pas d'heure d'été) : offset fixe, pas
// de bibliothèque de fuseaux pour un seul décalage constant.
const TUNIS_OFFSET_HOURS = 1;
const SEND_FROM_HOUR = 7; // heure locale à partir de laquelle on envoie

export type DigestReport = {
  sent: boolean;
  reason?: string;
  recipients?: number;
  leads?: number;
};

function tunisNow() {
  return new Date(Date.now() + TUNIS_OFFSET_HOURS * 3600_000);
}

/** Date locale au format YYYY-MM-DD, qui sert de clé d'unicité. */
function tunisDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function sendDailyDigest(force = false): Promise<DigestReport> {
  const now = tunisNow();
  const day = tunisDay(now);

  if (!force && now.getUTCHours() < SEND_FROM_HOUR) {
    return { sent: false, reason: `Trop tôt (${now.getUTCHours()}h à Tunis)` };
  }

  const already = await db.query.digestRuns.findFirst({
    where: eq(digestRuns.sentOn, day),
  });
  if (already && !force) return { sent: false, reason: "Déjà envoyé aujourd'hui" };

  const { getCallQueue } = await import("@/lib/queries");
  const queue = await getCallQueue(10);
  if (queue.length === 0) return { sent: false, reason: "Personne à rappeler" };

  const team = await db.select({ email: allowedEmails.email }).from(allowedEmails);
  if (team.length === 0) return { sent: false, reason: "Aucun destinataire (liste Équipe vide)" };

  const serious = queue.filter((l) => l.intent === "serieux").length;
  const neverCalled = queue.filter((l) => !l.lastCallAt).length;

  const { getEmailBranding } = await import("@/lib/queries");
  const branding = await getEmailBranding();
  const { renderEmailTemplate } = await import("@/lib/messaging/markdown");
  const { sendEmail } = await import("@/lib/messaging/email");

  const lines = queue.map((l, i) => {
    const bits = [l.intent === "serieux" ? "**sérieux**" : l.intent ?? "—", ...l.reasons.slice(0, 2)];
    return `${i + 1}. **${l.fullName || "Sans nom"}** — ${l.mobileNo ?? "pas de numéro"}\n   ${bits.join(" · ")}${l.objection ? `\n   Frein : ${l.objection}` : ""}`;
  });

  const md = [
    `## ${queue.length} personnes à rappeler`,
    "",
    `Dont **${serious} profil${serious > 1 ? "s" : ""} sérieux** et **${neverCalled} jamais appelé${neverCalled > 1 ? "s" : ""}**.`,
    "",
    ...lines,
    "",
    `[[Ouvrir la file du jour]](${baseUrl()}/aujourdhui)`,
  ].join("\n");

  const html = renderEmailTemplate(md, {}, branding ?? undefined);
  const subject = `${queue.length} leads à rappeler — ${serious} sérieux`;

  let delivered = 0;
  for (const person of team) {
    const res = await sendEmail({ to: person.email, subject, html });
    if (res.ok) delivered++;
  }

  // Marqué APRÈS l'envoi : un échec total doit pouvoir être retenté.
  if (delivered > 0) {
    await db
      .insert(digestRuns)
      .values({ sentOn: day, recipients: delivered, leadsListed: queue.length })
      .onConflictDoNothing();
  }

  return { sent: delivered > 0, recipients: delivered, leads: queue.length };
}

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001"
  );
}
