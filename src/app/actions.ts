"use server";

import { db } from "@/db";
import {
  leads,
  leadActivities,
  cohorts,
  sequences,
  sequenceSteps,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recomputeLeadScore } from "@/lib/scoring-server";
import { sendEmail } from "@/lib/messaging/email";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { sendSMS } from "@/lib/messaging/sms";
import { enrollLeadInSequence } from "@/lib/sequences";

// ── Move lead to a different pipeline stage ────────────

export async function moveLeadToStage(leadId: string, stageId: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) throw new Error("Lead not found");

  await db
    .update(leads)
    .set({ stageId, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await db.insert(leadActivities).values({
    leadId,
    type: "status_change",
    direction: "outbound",
    subject: "Changement d'étape",
    content: `${lead.stageId ?? "?"} → ${stageId}`,
  });

  revalidatePath("/pipeline");
}

// ── Add a note to a lead ───────────────────────────────

export async function addLeadNote(leadId: string, content: string) {
  if (!content.trim()) return;

  await db.insert(leadActivities).values({
    leadId,
    type: "note",
    direction: "outbound",
    content: content.trim(),
  });

  await db
    .update(leads)
    .set({ lastContactedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await recomputeLeadScore(leadId);
  revalidatePath(`/leads/${leadId}`);
}

// ── Update lead contact info ───────────────────────────

export async function updateLeadInfo(
  leadId: string,
  data: {
    fullName?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    notes?: string;
    cohortInterestId?: string | null;
  }
) {
  await db
    .update(leads)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await recomputeLeadScore(leadId);
  revalidatePath(`/leads/${leadId}`);
}

// ── Create a cohort ────────────────────────────────────

export async function createCohort(formData: FormData) {
  const name = formData.get("name") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const capacity = formData.get("capacity")
    ? Number(formData.get("capacity"))
    : null;

  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  await db.insert(cohorts).values({
    name,
    slug,
    startDate,
    endDate: endDate ?? undefined,
    capacity: capacity ?? undefined,
    status: "upcoming",
  });

  revalidatePath("/cohorts");
}

// ── Update cohort status ───────────────────────────────

export async function updateCohortStatus(cohortId: string, status: string) {
  await db
    .update(cohorts)
    .set({ status: status as (typeof cohorts.status.enumValues)[number] })
    .where(eq(cohorts.id, cohortId));

  revalidatePath("/cohorts");
}

// ── Send a message via email/whatsapp/sms ──────────────

export async function sendMessage(
  leadId: string,
  channel: "email" | "whatsapp" | "sms",
  subject: string | null,
  content: string
): Promise<{ ok: boolean; error?: string }> {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });
  if (!lead) return { ok: false, error: "Lead introuvable" };

  let result: { ok: boolean; error?: string };

  if (channel === "email") {
    if (!lead.email) return { ok: false, error: "Le lead n'a pas d'email" };
    result = await sendEmail({
      to: lead.email,
      subject: subject ?? "Space Academy",
      html: content.replace(/\n/g, "<br>"),
    });
  } else if (channel === "whatsapp") {
    if (!lead.whatsapp && !lead.phone)
      return { ok: false, error: "Le lead n'a pas de numéro WhatsApp" };
    result = await sendWhatsApp({
      to: lead.whatsapp ?? lead.phone!,
      body: content,
    });
  } else {
    if (!lead.phone)
      return { ok: false, error: "Le lead n'a pas de téléphone" };
    result = await sendSMS({ to: lead.phone, body: content });
  }

  // Log the activity regardless of success/failure
  await db.insert(leadActivities).values({
    leadId,
    type: channel,
    direction: "outbound",
    subject: subject ?? undefined,
    content: result.ok ? content : `[ÉCHEC] ${content}`,
  });

  if (result.ok) {
    await db
      .update(leads)
      .set({ lastContactedAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    await recomputeLeadScore(leadId);
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");

  return result;
}

// ── Log an inbound reply ───────────────────────────────

export async function logInboundReply(
  leadId: string,
  channel: "email" | "whatsapp" | "sms",
  content: string
) {
  await db.insert(leadActivities).values({
    leadId,
    type: channel,
    direction: "inbound",
    content,
  });

  await db
    .update(leads)
    .set({ lastContactedAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  await recomputeLeadScore(leadId);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
}

// ── Create a sequence with steps ───────────────────────

export async function createSequence(formData: FormData) {
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const trigger = (formData.get("trigger") as string) || "manual";

  const [seq] = await db
    .insert(sequences)
    .values({
      name,
      description: description ?? undefined,
      trigger: trigger as (typeof sequences.trigger.enumValues)[number],
      status: "draft",
    })
    .returning();

  // Parse steps from form data (step_1_channel, step_1_delay, etc.)
  const stepRegex = /^step_(\d+)_(channel|delay_days|subject|content)$/;
  const stepMap = new Map<
    number,
    {
      channel?: string;
      delayDays?: number;
      subject?: string;
      content?: string;
    }
  >();

  for (const [key, value] of formData.entries()) {
    const match = key.match(stepRegex);
    if (!match) continue;
    const stepNum = Number(match[1]);
    const field = match[2];
    const step = stepMap.get(stepNum) ?? {};
    if (field === "delay_days") {
      step.delayDays = Number(value);
    } else {
      step[field as "channel" | "subject" | "content"] = value as string;
    }
    stepMap.set(stepNum, step);
  }

  const sortedSteps = [...stepMap.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sortedSteps.length; i++) {
    const [, step] = sortedSteps[i];
    if (!step.content || !step.channel) continue;

    await db.insert(sequenceSteps).values({
      sequenceId: seq.id,
      order: i,
      channel: step.channel as (typeof sequenceSteps.channel.enumValues)[number],
      delayDays: step.delayDays ?? 0,
      subject: step.subject ?? undefined,
      content: step.content,
    });
  }

  revalidatePath("/sequences");
}

// ── Toggle sequence status ─────────────────────────────

export async function toggleSequenceStatus(sequenceId: string) {
  const seq = await db.query.sequences.findFirst({
    where: eq(sequences.id, sequenceId),
  });
  if (!seq) return;

  const newStatus = seq.status === "active" ? "paused" : "active";
  await db
    .update(sequences)
    .set({ status: newStatus })
    .where(eq(sequences.id, sequenceId));

  revalidatePath("/sequences");
}

// ── Enroll a lead in a sequence ────────────────────────

export async function enrollLead(leadId: string, sequenceId: string) {
  const result = await enrollLeadInSequence(leadId, sequenceId);
  revalidatePath("/sequences");
  return result;
}

// ── Enroll all stale leads in a sequence ───────────────

export async function enrollAllStaleLeads(
  sequenceId: string,
  staleLeadIds: string[]
) {
  let enrolled = 0;
  for (const leadId of staleLeadIds) {
    const result = await enrollLeadInSequence(leadId, sequenceId);
    if (result.ok) enrolled++;
  }
  revalidatePath("/sequences");
  return { enrolled, total: staleLeadIds.length };
}
