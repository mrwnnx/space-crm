import "server-only";
import { db } from "@/db";
import { automations, automationRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Déclencheur « le lead entre dans cette colonne ».
 *
 * Appelé depuis les TROIS chemins d'entrée (glisser-déposer, popup
 * d'inscription, import du site) : une règle qui ne marcherait que depuis le
 * kanban resterait muette sur les ~50 leads/semaine venus du formulaire.
 *
 * ⚠️ Ne jette JAMAIS. Un email refusé ne doit faire échouer ni le déplacement
 * du lead ni l'import — l'échec part au journal (`automation_runs`).
 *
 * ⚠️ L'envoi est ATTENDU, jamais lancé en tâche de fond : en serverless une
 * promesse non attendue est tuée au retour de la fonction (table vide, zéro
 * erreur).
 */
export async function runStatusAutomations(
  leadId: string,
  statusId: string | null | undefined
): Promise<void> {
  if (!statusId) return;

  try {
    const rules = await db.query.automations.findMany({
      where: and(eq(automations.statusId, statusId), eq(automations.active, true)),
    });
    if (rules.length === 0) return;

    const { getLeadById, getEmailTemplateById, createActivity } = await import("@/lib/queries");
    const lead = await getLeadById(leadId);
    if (!lead) return;

    for (const rule of rules) {
      const log = (status: "sent" | "skipped" | "failed", reason?: string) =>
        db.insert(automationRuns).values({
          automationId: rule.id,
          leadId,
          status,
          reason: reason ?? null,
        });

      // ── Garde-fous. Repris des campagnes : on n'écrit jamais à quelqu'un
      // qui s'est désabonné ni à une adresse morte.
      if (!lead.email) {
        await log("skipped", "Aucune adresse email sur le lead");
        continue;
      }
      if (lead.contact?.unsubscribedAt) {
        await log("skipped", "Contact désabonné");
        continue;
      }
      if (lead.contact?.bouncedAt) {
        await log("skipped", "Adresse en rebond");
        continue;
      }

      const template = await getEmailTemplateById(rule.emailTemplateId);
      if (!template) {
        await log("failed", "Modèle d'email introuvable");
        continue;
      }
      if (!template.subject?.trim()) {
        // L'objet fait partie de l'email : sans lui on enverrait un message
        // sans titre. On refuse plutôt que d'inventer.
        await log("skipped", "Le modèle n'a pas d'objet");
        continue;
      }

      const vars = buildVariables(lead);
      const { sendEmail, renderTemplate } = await import("@/lib/messaging/email");
      const { renderEmailTemplate } = await import("@/lib/messaging/markdown");
      // L'objet est du texte brut : substitution simple, sans échappement HTML
      // (sinon une esperluette s'afficherait « &amp; » dans la boîte de réception).
      const subject = renderTemplate(template.subject, vars);
      const html = renderEmailTemplate(template.content, vars);

      const res = await sendEmail({ to: lead.email, subject, html });

      if (!res.ok) {
        await log("failed", res.error ?? "Échec d'envoi");
        continue;
      }

      await log("sent");

      // Visible dans le fil du lead, attribué à la machine et pas à un humain
      // (cf. convention : une valeur sans « @ » est un acteur système).
      await createActivity({
        referenceType: "lead",
        referenceId: leadId,
        type: "email",
        direction: "outbound",
        subject,
        content: `Envoi automatique — modèle « ${template.name} »`,
        createdBy: "automation",
      });
    }
  } catch {
    // Le déplacement du lead et l'import priment sur l'automatisation.
  }
}

type LeadForVars = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  intendedPlan: string | null;
  bootcamp?: {
    name: string;
    currency: string | null;
    priceTotal: string | null;
    monthlyCount: number | null;
    monthlyAmount: string | null;
  } | null;
  contact?: { firstName: string | null; lastName: string | null } | null;
};

/** Variables utilisables dans l'objet ET dans le corps du modèle. */
export function buildVariables(lead: LeadForVars): Record<string, string> {
  const firstName = lead.firstName || lead.contact?.firstName || "";
  const lastName = lead.lastName || lead.contact?.lastName || "";
  const b = lead.bootcamp;
  const currency = b?.currency || "TND";

  let offre = "";
  if (lead.intendedPlan === "total" && b?.priceTotal) {
    offre = `${b.priceTotal} ${currency}`;
  } else if (lead.intendedPlan === "monthly" && b?.monthlyCount && b?.monthlyAmount) {
    offre = `${b.monthlyCount}× ${b.monthlyAmount} ${currency}`;
  }

  return {
    firstName,
    lastName,
    fullName: lead.fullName || [firstName, lastName].filter(Boolean).join(" "),
    email: lead.email || "",
    formation: b?.name || "",
    offre,
  };
}

/** Variables proposées dans l'interface, pour ne pas les deviner. */
export const AUTOMATION_VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "formation",
  "offre",
] as const;
