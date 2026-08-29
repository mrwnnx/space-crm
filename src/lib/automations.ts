import "server-only";
import { db } from "@/db";
import { automations, automationRuns, leads } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";

type RunStatus = "pending" | "sent" | "skipped" | "failed" | "cancelled";

/**
 * Déclencheur « le lead entre dans cette colonne ».
 *
 * Appelé depuis les TROIS chemins d'entrée (glisser-déposer, popup
 * d'inscription, import du site) : une règle qui ne marcherait que depuis le
 * kanban resterait muette sur les ~50 leads/semaine venus du formulaire.
 *
 * Délai 0 → envoi immédiat. Délai > 0 → mise en file d'attente, vidée par
 * /api/cron/automations.
 *
 * ⚠️ Ne jette JAMAIS : un email refusé ne doit faire échouer ni le déplacement
 * du lead ni l'import.
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

    for (const rule of rules) {
      if (rule.delayMinutes > 0) {
        // Rien n'est envoyé maintenant : on pose l'échéance, le cron s'en charge.
        await db.insert(automationRuns).values({
          automationId: rule.id,
          leadId,
          status: "pending",
          scheduledAt: new Date(Date.now() + rule.delayMinutes * 60_000),
        });
        continue;
      }
      await executeRule(rule, leadId);
    }
  } catch {
    // Le déplacement du lead et l'import priment sur l'automatisation.
  }
}

/**
 * Vide la file : envoie les automatisations dont l'échéance est passée.
 *
 * ⚠️ Les garde-fous sont évalués À L'ÉCHÉANCE, pas au moment du déclenchement :
 * entre les deux, le lead a pu se désabonner, changer d'adresse, ou quitter la
 * colonne. Un envoi programmé hier ne doit pas ignorer ce qui s'est passé depuis.
 */
export async function processDueAutomations(): Promise<{
  sent: number;
  cancelled: number;
  failed: number;
  skipped: number;
}> {
  const report = { sent: 0, cancelled: 0, failed: 0, skipped: 0 };

  const due = await db.query.automationRuns.findMany({
    where: and(
      eq(automationRuns.status, "pending"),
      lte(automationRuns.scheduledAt, new Date())
    ),
    limit: 100, // plafond par passage : une file accumulée ne part jamais d'un bloc
  });

  for (const run of due) {
    const rule = await db.query.automations.findFirst({
      where: eq(automations.id, run.automationId),
    });

    if (!rule || !rule.active) {
      await closeRun(run.id, "cancelled", "Automatisation supprimée ou désactivée");
      report.cancelled++;
      continue;
    }

    // Le lead est-il TOUJOURS dans la colonne déclencheuse ?
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, run.leadId),
      columns: { id: true, statusId: true },
    });
    if (!lead) {
      await closeRun(run.id, "cancelled", "Lead supprimé");
      report.cancelled++;
      continue;
    }
    if (lead.statusId !== rule.statusId) {
      await closeRun(run.id, "cancelled", "Le lead a quitté la colonne avant l'échéance");
      report.cancelled++;
      continue;
    }

    const status = await executeRule(rule, run.leadId, run.id);
    if (status === "sent") report.sent++;
    else if (status === "failed") report.failed++;
    else report.skipped++;
  }

  return report;
}

async function closeRun(runId: string, status: RunStatus, reason: string) {
  await db
    .update(automationRuns)
    .set({ status, reason })
    .where(eq(automationRuns.id, runId));
}

/**
 * Garde-fous + envoi + journal + trace dans le fil du lead.
 * `runId` fourni = on met à jour la ligne en attente au lieu d'en créer une.
 */
async function executeRule(
  rule: typeof automations.$inferSelect,
  leadId: string,
  runId?: string
): Promise<RunStatus> {
  const { getLeadById, getEmailTemplateById, createActivity, getEmailBranding } =
    await import("@/lib/queries");

  const log = async (status: RunStatus, reason?: string) => {
    if (runId) await closeRun(runId, status, reason ?? "");
    else
      await db
        .insert(automationRuns)
        .values({ automationId: rule.id, leadId, status, reason: reason ?? null });
    return status;
  };

  const lead = await getLeadById(leadId);
  if (!lead) return log("cancelled", "Lead introuvable");

  // Garde-fous repris des campagnes : on n'écrit jamais à quelqu'un qui s'est
  // désabonné ni à une adresse morte.
  if (!lead.email) return log("skipped", "Aucune adresse email sur le lead");
  if (lead.contact?.unsubscribedAt) return log("skipped", "Contact désabonné");
  if (lead.contact?.bouncedAt) return log("skipped", "Adresse en rebond");

  const template = await getEmailTemplateById(rule.emailTemplateId);
  if (!template) return log("failed", "Modèle d'email introuvable");
  if (!template.subject?.trim()) return log("skipped", "Le modèle n'a pas d'objet");

  const vars = buildVariables(lead);
  const { sendEmail, renderTemplate } = await import("@/lib/messaging/email");
  const { renderEmailTemplate } = await import("@/lib/messaging/markdown");
  const branding = await getEmailBranding();

  // L'objet est du texte brut : substitution simple, sans échappement HTML.
  const subject = renderTemplate(template.subject, vars);
  const html = renderEmailTemplate(template.content, vars, branding ?? undefined);

  const res = await sendEmail({ to: lead.email, subject, html });
  if (!res.ok) return log("failed", res.error ?? "Échec d'envoi");

  await log("sent");

  // Visible dans le fil du lead, attribué à la machine et pas à un humain.
  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "email",
    direction: "outbound",
    subject,
    content: `Envoi automatique — modèle « ${template.name} »`,
    createdBy: "automation",
  });

  return "sent";
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
