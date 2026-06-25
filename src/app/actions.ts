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
