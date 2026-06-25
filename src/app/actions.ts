"use server";

import { revalidatePath } from "next/cache";
import {
  createLead as createLeadQuery,
  updateLead as updateLeadQuery,
  updateLeadStatus as updateLeadStatusQuery,
  deleteLead as deleteLeadQuery,
  createActivity,
  createContact as createContactQuery,
  updateContact as updateContactQuery,
  deleteContact as deleteContactQuery,
  createOrganization as createOrganizationQuery,
  updateOrganization as updateOrganizationQuery,
  deleteOrganization as deleteOrganizationQuery,
  getOrCreateOrganizationByName,
  getLeadById,
  createDeal as createDealQuery,
  updateDeal as updateDealQuery,
  updateDealStatus as updateDealStatusQuery,
  deleteDeal as deleteDealQuery,
  getDefaultDealStatus,
  createNote as createNoteQuery,
  updateNote as updateNoteQuery,
  deleteNote as deleteNoteQuery,
  createTask as createTaskQuery,
  updateTask as updateTaskQuery,
  updateTaskStatus as updateTaskStatusQuery,
  deleteTask as deleteTaskQuery,
} from "@/lib/queries";

// ── Lead actions ───────────────────────────────────────

export async function createLeadAction(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return;

  const lead = await createLeadQuery({
    fullName,
    firstName: String(formData.get("firstName") || "").trim() || null,
    lastName: String(formData.get("lastName") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    mobileNo: String(formData.get("mobileNo") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    organizationName: String(formData.get("organizationName") || "").trim() || null,
    jobTitle: String(formData.get("jobTitle") || "").trim() || null,
    website: String(formData.get("website") || "").trim() || null,
    sourceId: String(formData.get("sourceId") || "") || null,
    industryId: String(formData.get("industryId") || "") || null,
  });

  revalidatePath("/leads");
  return lead;
}

export async function updateLeadFieldAction(
  leadId: string,
  field: string,
  value: string
) {
  const allowed = [
    "fullName",
    "firstName",
    "lastName",
    "email",
    "mobileNo",
    "phone",
    "jobTitle",
    "website",
    "organizationName",
  ];
  if (!allowed.includes(field)) return;

  await updateLeadQuery(leadId, { [field]: value || null });
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadStatusAction(
  leadId: string,
  statusId: string
) {
  const lead = await updateLeadStatusQuery(leadId, statusId);

  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "status_change",
    direction: "outbound",
    subject: "Statut modifié",
    content: `Nouveau statut: ${lead?.statusId ?? statusId}`,
  });

  const { createNotification } = await import("@/lib/queries");
  await createNotification({
    type: "lead_status_change",
    message: `Statut du lead modifié`,
    referenceType: "lead",
    referenceId: leadId,
    read: false,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function deleteLeadAction(leadId: string) {
  await deleteLeadQuery(leadId);
  revalidatePath("/leads");
}

export async function addLeadNoteAction(leadId: string, content: string) {
  if (!content.trim()) return;

  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "note",
    direction: "outbound",
    subject: "Note",
    content: content.trim(),
  });

  revalidatePath(`/leads/${leadId}`);
}

export async function convertToDealAction(leadId: string) {
  const lead = await getLeadById(leadId);
  if (!lead) return;

  // Auto-create organization from lead's organizationName (if provided)
  let organizationId: string | null = null;
  if (lead.organizationName) {
    const org = await getOrCreateOrganizationByName(lead.organizationName);
    organizationId = org.id;
    if (lead.industryId) {
      await updateOrganizationQuery(org.id, { industryId: lead.industryId });
    }
  }

  // Auto-create contact from lead
  const contact = await createContactQuery({
    firstName: lead.firstName,
    lastName: lead.lastName,
    fullName: lead.fullName,
    email: lead.email,
    mobileNo: lead.mobileNo,
    phone: lead.phone,
    organizationId,
  });

  // Mark lead as converted + link to org
  await updateLeadQuery(leadId, {
    converted: true,
    organizationId,
  });

  // Create the Deal linked to lead + org
  const defaultStatus = await getDefaultDealStatus();
  const deal = await createDealQuery({
    leadId,
    organizationId,
    statusId: defaultStatus?.id ?? null,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    mobileNo: lead.mobileNo,
    phone: lead.phone,
    website: lead.website,
    sourceId: lead.sourceId,
    industryId: lead.industryId,
  });

  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "status_change",
    direction: "outbound",
    subject: "Converti en Deal",
    content: `Contact ${contact.fullName} créé + Deal créé${organizationId ? " + organization liée" : ""}`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/deals");
  revalidatePath(`/deals/${deal.id}`);
  revalidatePath("/contacts");
  revalidatePath("/organizations");
}

// ── Contact actions ────────────────────────────────────

export async function createContactAction(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  if (!fullName) return;

  const organizationId = String(formData.get("organizationId") || "") || null;

  await createContactQuery({
    fullName,
    firstName: String(formData.get("firstName") || "").trim() || null,
    lastName: String(formData.get("lastName") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    mobileNo: String(formData.get("mobileNo") || "").trim() || null,
    phone: String(formData.get("phone") || "").trim() || null,
    organizationId: organizationId || null,
  });

  revalidatePath("/contacts");
}

export async function updateContactFieldAction(
  contactId: string,
  field: string,
  value: string
) {
  const allowed = [
    "fullName",
    "firstName",
    "lastName",
    "email",
    "mobileNo",
    "phone",
  ];
  if (!allowed.includes(field)) return;

  await updateContactQuery(contactId, { [field]: value || null });
  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteContactAction(contactId: string) {
  await deleteContactQuery(contactId);
  revalidatePath("/contacts");
}

// ── Organization actions ───────────────────────────────

export async function createOrganizationAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await createOrganizationQuery({
    name,
    website: String(formData.get("website") || "").trim() || null,
    industryId: String(formData.get("industryId") || "") || null,
    territoryId: String(formData.get("territoryId") || "") || null,
    annualRevenue: String(formData.get("annualRevenue") || "").trim() || null,
    noOfEmployees: (String(formData.get("noOfEmployees") || "") || null) as
      | "1-10"
      | "11-50"
      | "51-200"
      | "201-500"
      | "501-1000"
      | "1000+"
      | null,
  });

  revalidatePath("/organizations");
}

export async function updateOrganizationFieldAction(
  orgId: string,
  field: string,
  value: string
) {
  const allowed = ["name", "website", "annualRevenue"];
  if (!allowed.includes(field)) return;

  await updateOrganizationQuery(orgId, { [field]: value || null });
  revalidatePath(`/organizations/${orgId}`);
}

export async function deleteOrganizationAction(orgId: string) {
  await deleteOrganizationQuery(orgId);
  revalidatePath("/organizations");
}

// ── Deal actions ───────────────────────────────────────

export async function updateDealFieldAction(
  dealId: string,
  field: string,
  value: string
) {
  const allowed = [
    "dealValue",
    "probability",
    "nextStep",
    "expectedClosureDate",
    "lostNotes",
  ];
  if (!allowed.includes(field)) return;

  await updateDealQuery(dealId, { [field]: value || null });
  revalidatePath(`/deals/${dealId}`);
}

export async function updateDealStatusAction(
  dealId: string,
  statusId: string
) {
  const deal = await updateDealStatusQuery(dealId, statusId);

  await createActivity({
    referenceType: "deal",
    referenceId: dealId,
    type: "status_change",
    direction: "outbound",
    subject: "Statut modifié",
    content: `Nouveau statut: ${deal?.statusId ?? statusId}`,
  });

  const { createNotification } = await import("@/lib/queries");
  await createNotification({
    type: "deal_status_change",
    message: `Statut du deal modifié`,
    referenceType: "deal",
    referenceId: dealId,
    read: false,
  });

  revalidatePath("/deals");
  revalidatePath(`/deals/${dealId}`);
}

export async function markDealLostAction(
  dealId: string,
  lostReasonId: string,
  lostNotes: string
) {
  const defaultStatus = await getDefaultDealStatus();
  await updateDealQuery(dealId, {
    lostReasonId: lostReasonId || null,
    lostNotes: lostNotes || null,
    closedDate: new Date().toISOString().slice(0, 10),
  });

  await createActivity({
    referenceType: "deal",
    referenceId: dealId,
    type: "status_change",
    direction: "outbound",
    subject: "Deal perdu",
    content: lostNotes || "Marqué comme perdu",
  });

  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
}

export async function deleteDealAction(dealId: string) {
  await deleteDealQuery(dealId);
  revalidatePath("/deals");
}

export async function addDealNoteAction(dealId: string, content: string) {
  if (!content.trim()) return;

  await createActivity({
    referenceType: "deal",
    referenceId: dealId,
    type: "note",
    direction: "outbound",
    subject: "Note",
    content: content.trim(),
  });

  revalidatePath(`/deals/${dealId}`);
}

// ── Note actions ───────────────────────────────────────

export async function createNoteAction(formData: FormData) {
  const content = String(formData.get("content") || "").trim();
  if (!content) return;

  const referenceType = String(formData.get("referenceType") || "") || null;
  const referenceId = String(formData.get("referenceId") || "") || null;

  await createNoteQuery({
    title: String(formData.get("title") || "").trim() || null,
    content,
    referenceType: (referenceType as "lead" | "deal" | "contact" | "organization" | null) ?? null,
    referenceId: referenceId || null,
  });

  if (referenceType && referenceId) {
    revalidatePath(`/${referenceType === "lead" ? "leads" : referenceType === "deal" ? "deals" : referenceType + "s"}/${referenceId}`);
  }
  revalidatePath("/notes");
}

export async function deleteNoteAction(noteId: string) {
  await deleteNoteQuery(noteId);
  revalidatePath("/notes");
}

// ── Task actions ───────────────────────────────────────

export async function createTaskAction(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;

  const referenceType = String(formData.get("referenceType") || "") || null;
  const referenceId = String(formData.get("referenceId") || "") || null;
  const dueDate = String(formData.get("dueDate") || "") || null;

  await createTaskQuery({
    title,
    priority: (String(formData.get("priority") || "medium") as "low" | "medium" | "high") ?? "medium",
    status: "todo",
    assignedTo: String(formData.get("assignedTo") || "").trim() || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    description: String(formData.get("description") || "").trim() || null,
    referenceType: (referenceType as "lead" | "deal" | "contact" | "organization" | null) ?? null,
    referenceId: referenceId || null,
  });

  if (referenceType && referenceId) {
    revalidatePath(`/${referenceType === "lead" ? "leads" : referenceType === "deal" ? "deals" : referenceType + "s"}/${referenceId}`);
  }
  revalidatePath("/tasks");
}

export async function updateTaskStatusAction(taskId: string, status: string) {
  await updateTaskStatusQuery(taskId, status);
  revalidatePath("/tasks");
}

export async function deleteTaskAction(taskId: string) {
  await deleteTaskQuery(taskId);
  revalidatePath("/tasks");
}

// ── Messaging actions ──────────────────────────────────

export async function sendEmailAction(
  referenceType: "lead" | "deal",
  referenceId: string,
  to: string,
  subject: string,
  content: string,
  templateId?: string
) {
  const { sendEmail, renderTemplate } = await import("@/lib/messaging/email");

  let html = content;
  if (templateId) {
    const { getEmailTemplateById } = await import("@/lib/queries");
    const tpl = await getEmailTemplateById(templateId);
    if (tpl) {
      html = renderTemplate(tpl.content, { subject, content });
      subject = renderTemplate(tpl.subject || subject, { subject });
    }
  }

  const result = await sendEmail({ to, subject, html });

  await createActivity({
    referenceType,
    referenceId,
    type: "email",
    direction: "outbound",
    subject,
    content: html,
  });

  if (referenceType === "lead") {
    await updateLeadQuery(referenceId, { lastContactedAt: new Date() });
    revalidatePath(`/leads/${referenceId}`);
  } else {
    revalidatePath(`/deals/${referenceId}`);
  }

  return result;
}

export async function sendWhatsAppAction(
  referenceType: "lead" | "deal",
  referenceId: string,
  to: string,
  body: string
) {
  const { sendWhatsApp } = await import("@/lib/messaging/whatsapp");
  const result = await sendWhatsApp({ to, body });

  await createActivity({
    referenceType,
    referenceId,
    type: "whatsapp",
    direction: "outbound",
    subject: "WhatsApp envoyé",
    content: body,
  });

  if (referenceType === "lead") {
    await updateLeadQuery(referenceId, { lastContactedAt: new Date() });
    revalidatePath(`/leads/${referenceId}`);
  } else {
    revalidatePath(`/deals/${referenceId}`);
  }

  return result;
}

export async function sendSMSAction(
  referenceType: "lead" | "deal",
  referenceId: string,
  to: string,
  body: string
) {
  const { sendSMS } = await import("@/lib/messaging/sms");
  const result = await sendSMS({ to, body });

  await createActivity({
    referenceType,
    referenceId,
    type: "sms",
    direction: "outbound",
    subject: "SMS envoyé",
    content: body,
  });

  if (referenceType === "lead") {
    await updateLeadQuery(referenceId, { lastContactedAt: new Date() });
    revalidatePath(`/leads/${referenceId}`);
  } else {
    revalidatePath(`/deals/${referenceId}`);
  }

  return result;
}

export async function logCallAction(
  referenceType: "lead" | "deal",
  referenceId: string,
  formData: FormData
) {
  const { createCallLog } = await import("@/lib/queries");

  const type = String(formData.get("type") || "outgoing") as "incoming" | "outgoing";
  const status = String(formData.get("status") || "completed") as never;
  const duration = Number(formData.get("duration") || 0);
  const notes = String(formData.get("notes") || "").trim();

  await createCallLog({
    type,
    status,
    duration,
    telephonyMedium: "manual",
    referenceType,
    referenceId,
    startTime: new Date(),
    endTime: new Date(),
  });

  await createActivity({
    referenceType,
    referenceId,
    type: "call",
    direction: type === "incoming" ? "inbound" : "outbound",
    subject: `Appel ${type === "incoming" ? "entrant" : "sortant"}`,
    content: notes || `Durée: ${duration}s`,
  });

  if (referenceType === "lead") {
    await updateLeadQuery(referenceId, { lastContactedAt: new Date() });
    revalidatePath(`/leads/${referenceId}`);
  } else {
    revalidatePath(`/deals/${referenceId}`);
  }
  revalidatePath("/call-logs");
}

export async function addCommentAction(
  referenceType: "lead" | "deal" | "contact" | "organization",
  referenceId: string,
  content: string
) {
  if (!content.trim()) return;

  const { createComment } = await import("@/lib/queries");
  await createComment({
    referenceType,
    referenceId,
    content: content.trim(),
  });

  const pathMap: Record<string, string> = {
    lead: "leads",
    deal: "deals",
    contact: "contacts",
    organization: "organizations",
  };
  revalidatePath(`/${pathMap[referenceType]}/${referenceId}`);
}

// ── Email Template actions ─────────────────────────────

export async function createEmailTemplateAction(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!name || !content) return;

  const { createEmailTemplate } = await import("@/lib/queries");
  await createEmailTemplate({
    name,
    subject: String(formData.get("subject") || "").trim() || null,
    content,
  });

  revalidatePath("/settings");
}

export async function deleteEmailTemplateAction(id: string) {
  const { deleteEmailTemplate } = await import("@/lib/queries");
  await deleteEmailTemplate(id);
  revalidatePath("/settings");
}

// ── Data Import ────────────────────────────────────────

export async function bulkImportLeadsAction(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
) {
  const { createLead: createLeadQuery, getDefaultLeadStatus } = await import("@/lib/queries");
  const defaultStatus = await getDefaultLeadStatus();

  let created = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const leadData: Record<string, string | null> = {};
      for (const [csvCol, fieldName] of Object.entries(fieldMapping)) {
        if (fieldName && row[csvCol] !== undefined) {
          leadData[fieldName] = row[csvCol].trim() || null;
        }
      }

      if (!leadData.fullName) continue;

      await createLeadQuery({
        fullName: leadData.fullName,
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        phone: leadData.phone || null,
        organizationName: leadData.organizationName || null,
        jobTitle: leadData.jobTitle || null,
        website: leadData.website || null,
        statusId: defaultStatus?.id ?? null,
      });
      created++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/leads");
  return { created, errors, total: rows.length };
}

export async function bulkImportContactsAction(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
) {
  const { createContact: createContactQuery } = await import("@/lib/queries");

  let created = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const leadData: Record<string, string | null> = {};
      for (const [csvCol, fieldName] of Object.entries(fieldMapping)) {
        if (fieldName && row[csvCol] !== undefined) {
          leadData[fieldName] = row[csvCol].trim() || null;
        }
      }

      if (!leadData.fullName) continue;

      await createContactQuery({
        fullName: leadData.fullName,
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        phone: leadData.phone || null,
      });
      created++;
    } catch {
      errors++;
    }
  }

  revalidatePath("/contacts");
  return { created, errors, total: rows.length };
}

// ── Notification actions ───────────────────────────────

export async function markNotificationReadAction(id: string) {
  const { markNotificationRead } = await import("@/lib/queries");
  await markNotificationRead(id);
  revalidatePath("/");
}

export async function markAllNotificationsReadAction() {
  const { markAllNotificationsRead } = await import("@/lib/queries");
  await markAllNotificationsRead();
  revalidatePath("/");
}
