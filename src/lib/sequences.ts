import "server-only";
import { db } from "@/db";
import {
  sequences,
  sequenceSteps,
  sequenceEnrollments,
  sequenceSends,
  leads,
  leadStatuses,
} from "@/db/schema";
import { and, asc, eq, lte, sql } from "drizzle-orm";

/**
 * Séquences email.
 *
 * Une automatisation envoie UN email à l'entrée dans une colonne. Une séquence
 * enchaîne plusieurs étapes avec des délais et des conditions — et surtout,
 * elle SORT toute seule quand la personne a fait ce qu'on attendait.
 */

// La Tunisie est à UTC+1 toute l'année : offset fixe, pas de bibliothèque de
// fuseaux pour un seul décalage constant.
const TUNIS_OFFSET_MS = 3600_000;

function tunisHour(at = new Date()) {
  return new Date(at.getTime() + TUNIS_OFFSET_MS).getUTCHours();
}

/** Prochaine ouverture de la fenêtre d'envoi, en heure réelle (UTC). */
function nextWindowOpening(fromHour: number): Date {
  const now = new Date();
  const local = new Date(now.getTime() + TUNIS_OFFSET_MS);
  const target = new Date(local);
  target.setUTCHours(fromHour, 0, 0, 0);
  if (target <= local) target.setUTCDate(target.getUTCDate() + 1);
  return new Date(target.getTime() - TUNIS_OFFSET_MS);
}

export type EnrollTrigger = "lead_created" | "enters_status" | "tag_added";

/**
 * Inscrit un lead dans les séquences dont le déclencheur correspond.
 *
 * ⚠️ Une seule inscription par séquence et par lead (clé primaire composite) :
 * repasser dans une colonne ne relance pas la séquence depuis le début.
 */
export async function enrollLeadInSequences(
  leadId: string,
  trigger: EnrollTrigger,
  opts?: { statusId?: string | null; tagId?: string | null }
): Promise<number> {
  try {
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, leadId),
      columns: { id: true, bootcampId: true, statusId: true },
    });
    if (!lead?.bootcampId) return 0;

    const candidates = await db.query.sequences.findMany({
      where: and(
        eq(sequences.bootcampId, lead.bootcampId),
        eq(sequences.active, true),
        eq(sequences.trigger, trigger)
      ),
    });

    let enrolled = 0;
    for (const seq of candidates) {
      if (trigger === "enters_status" && seq.triggerStatusId !== opts?.statusId) continue;
      if (trigger === "tag_added" && seq.triggerTagId !== opts?.tagId) continue;

      const steps = await db.query.sequenceSteps.findMany({
        where: eq(sequenceSteps.sequenceId, seq.id),
        orderBy: [asc(sequenceSteps.position)],
        limit: 1,
      });
      if (steps.length === 0) continue; // séquence vide : rien à envoyer

      await db
        .insert(sequenceEnrollments)
        .values({
          sequenceId: seq.id,
          leadId,
          currentStep: 0,
          nextRunAt: new Date(Date.now() + steps[0].delayHours * 3600_000),
          statusAtEnrollment: lead.statusId,
        })
        .onConflictDoNothing();
      enrolled++;
    }
    return enrolled;
  } catch {
    // Une séquence ne doit jamais faire échouer l'import ni un déplacement.
    return 0;
  }
}

type ExitCheck = { exit: boolean; reason?: string };

/**
 * Raisons de SORTIR d'une séquence. C'est la brique la plus importante :
 * sans elle, on relance par email quelqu'un qui vient de payer.
 */
async function shouldExit(leadId: string): Promise<ExitCheck> {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    with: { contact: true, status: true },
  });
  if (!lead) return { exit: true, reason: "Lead supprimé" };
  if (lead.converted) return { exit: true, reason: "Inscrit" };
  if (lead.status?.kind === "converted") return { exit: true, reason: "Inscrit" };
  if (lead.status?.kind === "lost") return { exit: true, reason: "Marqué perdu" };
  if (lead.contact?.unsubscribedAt) return { exit: true, reason: "Désabonné" };
  if (lead.contact?.bouncedAt) return { exit: true, reason: "Adresse en rebond" };
  if (lead.qualification === "hors_cible" || lead.qualification === "pas_serieux") {
    return { exit: true, reason: `Qualifié ${lead.qualification}` };
  }
  if (!lead.email) return { exit: true, reason: "Aucune adresse email" };
  return { exit: false };
}

/** Le clic est le seul signal d'engagement fiable — les ouvertures sont
 *  gonflées par les protections de confidentialité des clients mail. */
async function hasClicked(enrollmentId: string, stepId: string): Promise<boolean> {
  const rows = await db
    .select({ id: sequenceSends.id })
    .from(sequenceSends)
    .where(
      and(
        eq(sequenceSends.enrollmentId, enrollmentId),
        eq(sequenceSends.stepId, stepId),
        sql`${sequenceSends.clickedAt} is not null`
      )
    )
    .limit(1);
  return rows.length > 0;
}

export type SequenceReport = {
  sent: number;
  skipped: number;
  exited: number;
  postponed: number;
  failed: number;
};

export async function processSequences(): Promise<SequenceReport> {
  const report: SequenceReport = { sent: 0, skipped: 0, exited: 0, postponed: 0, failed: 0 };

  const active = await db.query.sequences.findMany({
    where: eq(sequences.active, true),
  });
  if (active.length === 0) return report;

  const { getEmailBranding, getEmailTemplateById, createActivity } = await import("@/lib/queries");
  const { buildVariables } = await import("@/lib/automations");
  const { sendEmail, renderTemplate } = await import("@/lib/messaging/email");
  const { renderEmailTemplate } = await import("@/lib/messaging/markdown");
  const branding = await getEmailBranding();

  for (const seq of active) {
    // Hors de la fenêtre d'envoi : on reporte au lieu d'envoyer à 3 h du matin.
    const hour = tunisHour();
    const inWindow = hour >= seq.sendFromHour && hour < seq.sendToHour;

    const due = await db.query.sequenceEnrollments.findMany({
      where: and(
        eq(sequenceEnrollments.sequenceId, seq.id),
        eq(sequenceEnrollments.status, "active"),
        lte(sequenceEnrollments.nextRunAt, new Date())
      ),
      limit: seq.dailyCap,
    });
    if (due.length === 0) continue;

    if (!inWindow) {
      const when = nextWindowOpening(seq.sendFromHour);
      for (const e of due) {
        await db
          .update(sequenceEnrollments)
          .set({ nextRunAt: when, updatedAt: new Date() })
          .where(
            and(
              eq(sequenceEnrollments.sequenceId, e.sequenceId),
              eq(sequenceEnrollments.leadId, e.leadId)
            )
          );
        report.postponed++;
      }
      continue;
    }

    const steps = await db.query.sequenceSteps.findMany({
      where: eq(sequenceSteps.sequenceId, seq.id),
      orderBy: [asc(sequenceSteps.position)],
    });

    for (const enr of due) {
      const key = and(
        eq(sequenceEnrollments.sequenceId, enr.sequenceId),
        eq(sequenceEnrollments.leadId, enr.leadId)
      );

      // Les sorties sont réévaluées À CHAQUE ÉTAPE, pas à l'inscription :
      // entre deux emails, la personne a pu s'inscrire ou se désabonner.
      const exit = await shouldExit(enr.leadId);
      if (exit.exit) {
        await db
          .update(sequenceEnrollments)
          .set({ status: "exited", exitReason: exit.reason, updatedAt: new Date() })
          .where(key);
        report.exited++;
        continue;
      }

      const step = steps[enr.currentStep];
      if (!step) {
        await db
          .update(sequenceEnrollments)
          .set({ status: "done", updatedAt: new Date() })
          .where(key);
        continue;
      }

      // Condition d'étape.
      let passes = true;
      if (step.condition !== "none") {
        const refStepId =
          step.conditionOnStepId ?? steps[Math.max(enr.currentStep - 1, 0)]?.id ?? null;
        if (step.condition === "clicked" || step.condition === "not_clicked") {
          const clicked = refStepId
            ? await hasClicked(enr.id, refStepId)
            : false;
          passes = step.condition === "clicked" ? clicked : !clicked;
        } else if (step.condition === "has_tag" || step.condition === "no_tag") {
          // « Est-il ENCORE tagué ? » — n'a de sens que si quelqu'un retire
          // les tags. Sans discipline d'équipe, la condition est toujours vraie.
          const tagId = seq.triggerTagId;
          if (!tagId) passes = step.condition === "no_tag";
          else {
            const { leadTags } = await import("@/db/schema");
            const rows = await db
              .select({ leadId: leadTags.leadId })
              .from(leadTags)
              .where(and(eq(leadTags.leadId, enr.leadId), eq(leadTags.tagId, tagId)))
              .limit(1);
            const tagged = rows.length > 0;
            passes = step.condition === "has_tag" ? tagged : !tagged;
          }
        } else if (step.condition === "not_moved") {
          const lead = await db.query.leads.findFirst({
            where: eq(leads.id, enr.leadId),
            columns: { statusId: true },
          });
          passes = lead?.statusId === enr.statusAtEnrollment;
        }
      }

      const next = steps[enr.currentStep + 1];
      const advance = {
        currentStep: enr.currentStep + 1,
        nextRunAt: next ? new Date(Date.now() + next.delayHours * 3600_000) : null,
        status: next ? ("active" as const) : ("done" as const),
        updatedAt: new Date(),
      };

      if (!passes) {
        // Condition non remplie : on saute l'étape sans envoyer, on n'arrête
        // pas la séquence — l'étape suivante peut très bien s'appliquer.
        await db.update(sequenceEnrollments).set(advance).where(key);
        report.skipped++;
        continue;
      }

      const template = await getEmailTemplateById(step.emailTemplateId);
      const lead = await db.query.leads.findFirst({
        where: eq(leads.id, enr.leadId),
        with: { bootcamp: true, contact: true },
      });
      if (!template?.subject?.trim() || !lead?.email) {
        await db.update(sequenceEnrollments).set(advance).where(key);
        report.skipped++;
        continue;
      }

      const vars = buildVariables(lead);
      const res = await sendEmail({
        to: lead.email,
        subject: renderTemplate(template.subject, vars),
        html: renderEmailTemplate(template.content, vars, branding ?? undefined, {
          enabled: template.buttonEnabled,
          label: template.buttonLabel,
          url: template.buttonUrl,
          position: template.buttonPosition,
        }),
      });

      if (!res.ok) {
        // Échec (quota Resend, adresse refusée) : on NE fait pas avancer, la
        // prochaine passe réessaiera. Sans ça l'étape serait perdue en silence.
        report.failed++;
        continue;
      }

      await db.insert(sequenceSends).values({
        enrollmentId: enr.id,
        stepId: step.id,
        leadId: enr.leadId,
        resendId: res.id ?? null,
      });

      await createActivity({
        referenceType: "lead",
        referenceId: enr.leadId,
        type: "email",
        direction: "outbound",
        subject: renderTemplate(template.subject, vars),
        content: `Séquence « ${seq.name} » — étape ${step.position + 1}`,
        createdBy: "automation",
      });

      await db.update(sequenceEnrollments).set(advance).where(key);
      report.sent++;
    }
  }

  return report;
}
