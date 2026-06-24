import "server-only";
import { db } from "@/db";
import {
  sequences,
  sequenceSteps,
  sequenceEnrollments,
  leads,
  leadActivities,
} from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { sendEmail } from "@/lib/messaging/email";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { sendSMS } from "@/lib/messaging/sms";
import { recomputeLeadScore } from "@/lib/scoring-server";

// ── Process all due sequence steps ─────────────────────

export async function runSequenceRunner() {
  // Find all active enrollments with a due next step
  const dueEnrollments = await db
    .select()
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.status, "active"),
        lte(sequenceEnrollments.nextStepAt, new Date())
      )
    );

  const results = { processed: 0, sent: 0, failed: 0, completed: 0 };

  for (const enrollment of dueEnrollments) {
    results.processed++;

    // Fetch the sequence and its steps
    const seq = await db.query.sequences.findFirst({
      where: eq(sequences.id, enrollment.sequenceId),
      with: {
        steps: {
          orderBy: [sequenceSteps.order],
        },
      },
    });

    if (!seq || seq.status !== "active") continue;

    const step = seq.steps[enrollment.currentStep];
    if (!step) {
      // No more steps — mark as completed
      await db
        .update(sequenceEnrollments)
        .set({ status: "completed" })
        .where(eq(sequenceEnrollments.id, enrollment.id));
      results.completed++;
      continue;
    }

    // Fetch the lead
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, enrollment.leadId),
    });
    if (!lead) continue;

    // Send the message
    let sent = false;
    if (step.channel === "email" && lead.email) {
      const res = await sendEmail({
        to: lead.email,
        subject: step.subject ?? seq.name,
        html: step.content.replace(/\n/g, "<br>"),
      });
      sent = res.ok;
    } else if (step.channel === "whatsapp" && (lead.whatsapp || lead.phone)) {
      const res = await sendWhatsApp({
        to: lead.whatsapp ?? lead.phone!,
        body: step.content,
      });
      sent = res.ok;
    } else if (step.channel === "sms" && lead.phone) {
      const res = await sendSMS({ to: lead.phone, body: step.content });
      sent = res.ok;
    }

    if (sent) {
      results.sent++;
      // Log the activity
      await db.insert(leadActivities).values({
        leadId: lead.id,
        type: step.channel,
        direction: "outbound",
        subject: `[Auto] ${step.subject ?? seq.name}`,
        content: step.content,
      });

      // Update lastContactedAt
      await db
        .update(leads)
        .set({ lastContactedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, lead.id));

      await recomputeLeadScore(lead.id);
    } else {
      results.failed++;
    }

    // Advance to next step
    const nextStepIndex = enrollment.currentStep + 1;
    const nextStep = seq.steps[nextStepIndex];

    if (nextStep) {
      // Schedule next step
      const nextStepAt = new Date();
      nextStepAt.setDate(nextStepAt.getDate() + nextStep.delayDays);

      await db
        .update(sequenceEnrollments)
        .set({
          currentStep: nextStepIndex,
          nextStepAt,
        })
        .where(eq(sequenceEnrollments.id, enrollment.id));
    } else {
      // Sequence completed
      await db
        .update(sequenceEnrollments)
        .set({ status: "completed" })
        .where(eq(sequenceEnrollments.id, enrollment.id));
      results.completed++;
    }
  }

  return results;
}

// ── Enroll a lead in a sequence ────────────────────────

export async function enrollLeadInSequence(leadId: string, sequenceId: string) {
  // Check if already enrolled and active
  const existing = await db
    .select()
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.leadId, leadId),
        eq(sequenceEnrollments.sequenceId, sequenceId),
        eq(sequenceEnrollments.status, "active")
      )
    )
    .limit(1);

  if (existing.length > 0) return { ok: false, error: "Déjà inscrit" };

  await db.insert(sequenceEnrollments).values({
    leadId,
    sequenceId,
    currentStep: 0,
    status: "active",
    nextStepAt: new Date(), // Start immediately
  });

  return { ok: true };
}
