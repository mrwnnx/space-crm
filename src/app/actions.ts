"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  getBootcampById,
  createBootcamp as createBootcampQuery,
  updateBootcamp as updateBootcampQuery,
  deleteBootcamp as deleteBootcampQuery,
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

// ── Bootcamp (Formation) actions ───────────────────────

export async function createBootcampAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const slug = String(formData.get("slug") || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  await createBootcampQuery({
    name,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    startDate: String(formData.get("startDate") || "") || null,
    endDate: String(formData.get("endDate") || "") || null,
    status: (String(formData.get("status") || "open") as "draft" | "open" | "in_progress" | "completed" | "cancelled") ?? "open",
    capacity: Number(formData.get("capacity") || 0) || null,
    // Offre & paiement (Phase 3a UI)
    currency: String(formData.get("currency") || "TND").trim() || "TND",
    priceTotal: String(formData.get("priceTotal") || "").trim() || null,
    monthlyCount: Number(formData.get("monthlyCount") || 0) || null,
    monthlyAmount: String(formData.get("monthlyAmount") || "").trim() || null,
  });

  revalidatePath("/bootcamps");
}

export async function updateBootcampFieldAction(
  bootcampId: string,
  field: string,
  value: string
) {
  await requireUser();
  const allowed = [
    "name",
    "slug",
    "description",
    "startDate",
    "endDate",
    "status",
    "capacity",
    "currency",
    "priceTotal",
    "monthlyCount",
    "monthlyAmount",
  ];
  if (!allowed.includes(field)) return;

  const data: Record<string, unknown> = { [field]: value || null };
  // Convertir startDate/endDate en Date
  if (field === "startDate" || field === "endDate") {
    data[field] = value ? value : null;
  }
  if (field === "capacity") {
    data[field] = value ? Number(value) : null;
  }
  if (field === "monthlyCount") {
    data[field] = value ? Number(value) : null;
  }
  // priceTotal, monthlyAmount, currency : string direct (null si vide)

  await updateBootcampQuery(bootcampId, data as never);
  revalidatePath(`/bootcamps/${bootcampId}`);
  revalidatePath("/bootcamps");
}

export async function deleteBootcampAction(bootcampId: string) {
  await requireUser();
  await deleteBootcampQuery(bootcampId);
  revalidatePath("/bootcamps");
}

// ── Form Sources (formulaires Elementor) actions ───────

// Mapping par défaut champ Elementor → colonne lead whitelistée.
const DEFAULT_FIELD_MAPPING: Record<string, string> = {
  name: "fullName",
  email: "email",
  phone: "mobileNo",
};

// Parse + valide le fieldMapping (objet JSON { champ: colonne }). Le webhook
// re-filtre de toute façon sur sa whitelist ALLOWED_LEAD_FIELDS à la réception.
function parseFieldMapping(
  raw: string
): { ok: true; value: Record<string, string> } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: DEFAULT_FIELD_MAPPING };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false };
    }
    const value: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) value[String(k)] = String(v);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

async function readFormSourceFields(bootcampId: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Le nom du formulaire est requis." as const };

  const temperature =
    String(formData.get("temperature") || "cold") === "hot" ? "hot" : "cold";
  const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  const active = formData.get("active") != null;

  const fm = parseFieldMapping(String(formData.get("fieldMapping") || ""));
  if (!fm.ok) return { error: "fieldMapping : JSON invalide (objet attendu)." as const };

  let targetStatusId =
    String(formData.get("targetStatusId") || "").trim() || null;
  if (!targetStatusId) {
    const { getLeadStatuses } = await import("@/lib/queries");
    const statuses = await getLeadStatuses(bootcampId);
    targetStatusId =
      statuses.find((s) => s.kind === "normal")?.id ?? statuses[0]?.id ?? null;
  }

  return {
    fields: {
      name,
      temperature: temperature as "hot" | "cold",
      defaultTagIds: tagIds,
      active,
      fieldMapping: fm.value,
      targetStatusId,
    },
  };
}

export async function createFormSourceAction(
  bootcampId: string,
  formData: FormData
) {
  await requireUser();
  if (!bootcampId) return { error: "Formation requise." };

  const parsed = await readFormSourceFields(bootcampId, formData);
  if ("error" in parsed) return { error: parsed.error };

  const { createFormSource } = await import("@/lib/queries");
  await createFormSource({
    bootcampId,
    ...parsed.fields,
    webhookToken: crypto.randomUUID(), // token unique généré automatiquement
  });
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

export async function updateFormSourceAction(
  formSourceId: string,
  bootcampId: string,
  formData: FormData
) {
  await requireUser();
  const parsed = await readFormSourceFields(bootcampId, formData);
  if ("error" in parsed) return { error: parsed.error };

  const { updateFormSource } = await import("@/lib/queries");
  // webhookToken jamais modifié ici (immuable côté UI).
  await updateFormSource(formSourceId, parsed.fields);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

// Soft delete par défaut : on désactive (active=false) sans supprimer la ligne.
export async function setFormSourceActiveAction(
  formSourceId: string,
  bootcampId: string,
  active: boolean
) {
  await requireUser();
  const { updateFormSource } = await import("@/lib/queries");
  await updateFormSource(formSourceId, { active });
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

// ── Désignation kind d'une colonne (Converti / Perdu / Normal) ──
export async function setStageKindAction(
  bootcampId: string,
  statusId: string,
  kind: string
) {
  await requireUser();
  if (kind !== "normal" && kind !== "converted" && kind !== "lost") {
    return { error: "Type de colonne invalide." };
  }
  const { setStageKind, getLeadStatuses } = await import("@/lib/queries");
  await setStageKind(bootcampId, statusId, kind);
  revalidatePath(`/bootcamps/${bootcampId}`);

  // Garde-fou non bloquant : un bootcamp devrait toujours avoir converted + lost.
  const statuses = await getLeadStatuses(bootcampId);
  if (!statuses.some((s) => s.kind === "converted")) {
    return {
      ok: true,
      warning:
        "Aucune colonne « Converti » : plus aucune inscription possible tant que tu n'en désignes pas une.",
    };
  }
  if (!statuses.some((s) => s.kind === "lost")) {
    return { ok: true, warning: "Aucune colonne « Perdu » désignée." };
  }
  return { ok: true };
}

// ── Colonnes (stages) : créer / renommer / supprimer ───

export async function createStageAction(bootcampId: string, name: string) {
  await requireUser();
  if (!bootcampId) return { error: "Formation requise." };
  const { createStage } = await import("@/lib/queries");
  await createStage(bootcampId, name.trim() || "Nouvelle colonne");
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

export async function renameStageAction(
  bootcampId: string,
  statusId: string,
  name: string
) {
  await requireUser();
  const clean = name.trim();
  if (!clean) return { error: "Le nom est requis." };
  const { renameStage } = await import("@/lib/queries");
  await renameStage(statusId, clean); // whitelist : name uniquement
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

export async function deleteStageAction(bootcampId: string, statusId: string) {
  await requireUser();
  const { getLeadStatusById, countLeadsByStatus, deleteStage } = await import(
    "@/lib/queries"
  );
  const stage = await getLeadStatusById(statusId);
  if (!stage) return { error: "Colonne introuvable." };
  // États terminaux jamais supprimables (préserve 1 converted + 1 lost).
  if (stage.kind === "converted" || stage.kind === "lost") {
    return { error: "Colonne terminale (Converti/Perdu) : non supprimable." };
  }
  // Bloqué si la colonne contient des leads (option A : pas de déplacement auto).
  const count = await countLeadsByStatus(statusId);
  if (count > 0) {
    return {
      error: `Déplace d'abord les ${count} lead${count > 1 ? "s" : ""} de cette colonne.`,
    };
  }
  await deleteStage(statusId);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

// Réordonne les colonnes selon l'ordre d'ids fourni (positions 0..n).
export async function reorderStagesAction(
  bootcampId: string,
  orderedIds: string[]
) {
  await requireUser();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { error: "Ordre invalide." };
  }
  const { reorderStages } = await import("@/lib/queries");
  await reorderStages(bootcampId, orderedIds);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

// ── Lead actions ───────────────────────────────────────

export async function createLeadAction(formData: FormData) {
  await requireUser();

  // Formation OBLIGATOIRE : leads.bootcamp_id est NOT NULL — un lead appartient toujours
  // à une formation. Sans elle, on n'insère pas (sinon erreur PG 23502).
  const bootcampId = String(formData.get("bootcampId") || "").trim();
  if (!bootcampId) {
    return { error: "Choisis une formation." };
  }

  // Identité : prénom + nom → fullName (NOT NULL en base).
  const firstName = String(formData.get("firstName") || "").trim() || null;
  const lastName = String(formData.get("lastName") || "").trim() || null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (!fullName) {
    return { error: "Le prénom est requis." };
  }

  const email = String(formData.get("email") || "").trim() || null;
  const mobileNo = String(formData.get("mobileNo") || "").trim() || null;
  // Infos de LA PERSONNE → portées par le contact.
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;
  const ageRaw = String(formData.get("age") || "").trim();
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : null;
  // Infos de L'INSCRIPTION → portées par le lead.
  const promoCode = String(formData.get("promoCode") || "").trim() || null;
  const intendedPlanRaw = String(formData.get("intendedPlan") || "");
  const intendedPlan =
    intendedPlanRaw === "total" || intendedPlanRaw === "monthly"
      ? intendedPlanRaw
      : null;

  // Statut : 1ère colonne (plus basse position) du pipeline du bootcamp si non fourni.
  const { getOrCreateContactForLead, getLeadStatuses } = await import("@/lib/queries");
  let statusId = String(formData.get("statusId") || "").trim() || null;
  if (!statusId) {
    const statuses = await getLeadStatuses(bootcampId); // triés par position asc
    statusId = statuses[0]?.id ?? null;
  }

  // Dédup contact : on rattache la personne dès la création manuelle (Phase 2).
  const contact = await getOrCreateContactForLead({
    email,
    mobileNo,
    firstName,
    lastName,
    fullName,
    whatsapp,
    age: age !== null && !Number.isNaN(age) ? age : null,
  });

  await createLeadQuery({
    fullName,
    firstName,
    lastName,
    email,
    mobileNo,
    intendedPlan,
    promoCode,
    sourceId: String(formData.get("sourceId") || "") || null,
    bootcampId,
    statusId,
    stageEnteredAt: new Date(),
    contactId: contact.id,
  });

  revalidatePath("/leads");
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true };
}

export async function updateLeadFieldAction(
  leadId: string,
  field: string,
  value: string
) {
  await requireUser();
  const allowed = [
    "fullName",
    "firstName",
    "lastName",
    "email",
    "mobileNo",
    "phone",
    "intendedPlan",
    "promoCode",
  ];
  if (!allowed.includes(field)) return;

  await updateLeadQuery(leadId, { [field]: value || null });

  // L'email doit suivre sur le CONTACT : c'est lui qui sert aux campagnes.
  // Sans ça, corriger une adresse ici ne change rien à qui reçoit quoi.
  if (field === "email") {
    const { syncLeadEmailToContact } = await import("@/lib/queries");
    await syncLeadEmailToContact(leadId, value || null);
  }

  revalidatePath(`/leads/${leadId}`);
}

// Édite un champ porté par le CONTACT lié (whatsapp, âge) depuis la fiche lead,
// et revalide la page du lead pour refléter le changement.
export async function updateLeadContactFieldAction(
  leadId: string,
  contactId: string,
  field: string,
  value: string
) {
  await requireUser();
  const allowed = ["whatsapp", "age"];
  if (!allowed.includes(field)) return;

  if (field === "age") {
    const n = value.trim() ? Number.parseInt(value, 10) : null;
    if (n !== null && Number.isNaN(n)) return;
    await updateContactQuery(contactId, { age: n });
  } else {
    await updateContactQuery(contactId, { whatsapp: value.trim() || null });
  }
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadStatusAction(
  leadId: string,
  statusId: string
) {
  await requireUser();
  // Capture l'ancien statut AVANT l'update (pour stage_history) — Phase 1, ajout pur.
  const { getLeadStatusId, recordStageChange } = await import("@/lib/queries");
  const oldStatusId = await getLeadStatusId(leadId);

  const lead = await updateLeadStatusQuery(leadId, statusId);

  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "status_change",
    direction: "outbound",
    subject: "Statut modifié",
    content: `Nouveau statut: ${lead?.statusId ?? statusId}`,
  });

  // Capture structurée de la transition (Phase 1) — à côté du createActivity existant.
  await recordStageChange(leadId, oldStatusId, lead?.statusId ?? statusId);

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
  await requireUser();
  await deleteLeadQuery(leadId);
  revalidatePath("/leads");
}

export async function addLeadNoteAction(leadId: string, content: string) {
  await requireUser();
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
  await requireUser();
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

  // Capture structurée (Phase 1) : enregistre le stage du lead au moment de la conversion.
  // toStatusId = null car la conversion actuelle (B2B) ne déplace pas le lead vers un stage
  // "Converti" formation — ce flux sera réécrit en Phase 2/3.
  const { recordStageChange } = await import("@/lib/queries");
  await recordStageChange(leadId, lead.status?.id ?? null, null);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/deals");
  revalidatePath(`/deals/${deal.id}`);
  revalidatePath("/contacts");
  revalidatePath("/organizations");
}

// ── Inscription à une formation (Phase 3a) ─────────────
// La VRAIE conversion du CRM formation-centric : inscrire un lead à sa formation,
// avec plan de paiement. Ne crée NI deal NI organisation (contrairement à
// convertToDealAction qui reste intacte pour le sous-système B2B legacy).
export async function enrollLeadAction(
  leadId: string,
  input: { plan: "total" | "monthly"; firstPaymentReceived: boolean }
) {
  await requireUser();

  const {
    getLeadById,
    getConvertedStageForBootcamp,
    paymentStatus,
  } = await import("@/lib/queries");

  // 2. Charge le lead + son bootcamp
  const lead = await getLeadById(leadId);
  if (!lead) return { error: "Lead introuvable" };
  const bootcamp = lead.bootcamp;
  if (!bootcamp) return { error: "Lead non rattaché à une formation" };

  // 3. Garde-fous
  if (lead.converted) return { error: "déjà inscrit" };
  if (lead.status?.kind === "converted") return { error: "déjà inscrit" };

  if (input.plan === "total" && !bootcamp.priceTotal) {
    return { error: "offre Total non configurée sur la formation" };
  }
  if (input.plan === "monthly" && (!bootcamp.monthlyCount || !bootcamp.monthlyAmount)) {
    return { error: "offre Mensuelle non configurée" };
  }

  // 4. Stage kind='converted' du bootcamp
  const convertedStage = await getConvertedStageForBootcamp(bootcamp.id);
  if (!convertedStage) {
    return { error: "cette formation n'a pas de colonne Converti" };
  }

  // 5-8. Transaction atomique : les écritures réussissent ensemble ou aucune.
  // Les helpers DAL sont transaction-aware (exec = tx) — une seule source de vérité
  // pour le calcul des dueDate (generateScheduleForLead) et l'insertion stage_history
  // (moveLeadToStage). Aucune logique dupliquée ici.
  const { db } = await import("@/db");
  const {
    moveLeadToStage,
    generateScheduleForLead,
    markFirstEcheancePaid,
  } = await import("@/lib/queries");
  const { leads: leadsTable } = await import("@/db/schema");
  const { eq: eqOp } = await import("drizzle-orm");

  await db.transaction(async (tx) => {
    // 5. Déplace le lead vers le stage converted (insère stage_history en interne)
    await moveLeadToStage(leadId, convertedStage.id, tx);

    // 6. Marque le lead converti
    await tx
      .update(leadsTable)
      .set({ converted: true, convertedAt: new Date(), updatedAt: new Date() })
      .where(eqOp(leadsTable.id, leadId));

    // 7. Génère l'échéancier (logique dueDate centralisée dans le helper)
    await generateScheduleForLead(leadId, input.plan, tx);

    // 8. 1er paiement encaissé → marque la première échéance
    if (input.firstPaymentReceived) {
      await markFirstEcheancePaid(leadId, tx);
    }
  });

  // 9. revalidate
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/bootcamps/${bootcamp.id}`);

  // 10. Retourne le statut paiement dérivé
  const status = await paymentStatus(leadId);
  return { ok: true, paymentStatus: status };
}

// ── Payment schedule actions (Phase 3b) ────────────────

export async function markEcheancePaidAction(echeanceId: string) {
  await requireUser();
  const { markEcheancePaid, getScheduleForLead } = await import("@/lib/queries");
  const { paymentSchedules } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");

  const [ech] = await db.select({ leadId: paymentSchedules.leadId }).from(paymentSchedules).where(eq(paymentSchedules.id, echeanceId)).limit(1);
  if (!ech) return { error: "Échéance introuvable" };

  await markEcheancePaid(echeanceId);
  const schedule = await getScheduleForLead(ech.leadId);
  revalidatePath(`/leads/${ech.leadId}`);
  return { ok: true, status: schedule.summary.status };
}

export async function markEcheanceUnpaidAction(echeanceId: string) {
  await requireUser();
  const { markEcheanceUnpaid, getScheduleForLead } = await import("@/lib/queries");
  const { paymentSchedules } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");

  const [ech] = await db.select({ leadId: paymentSchedules.leadId }).from(paymentSchedules).where(eq(paymentSchedules.id, echeanceId)).limit(1);
  if (!ech) return { error: "Échéance introuvable" };

  await markEcheanceUnpaid(echeanceId);
  const schedule = await getScheduleForLead(ech.leadId);
  revalidatePath(`/leads/${ech.leadId}`);
  return { ok: true, status: schedule.summary.status };
}

// ── Contact actions ────────────────────────────────────

export async function createContactAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  await deleteContactQuery(contactId);
  revalidatePath("/contacts");
}

// ── Organization actions ───────────────────────────────

export async function createOrganizationAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
  const allowed = ["name", "website", "annualRevenue"];
  if (!allowed.includes(field)) return;

  await updateOrganizationQuery(orgId, { [field]: value || null });
  revalidatePath(`/organizations/${orgId}`);
}

export async function deleteOrganizationAction(orgId: string) {
  await requireUser();
  await deleteOrganizationQuery(orgId);
  revalidatePath("/organizations");
}

// ── Deal actions ───────────────────────────────────────

export async function updateDealFieldAction(
  dealId: string,
  field: string,
  value: string
) {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  await deleteDealQuery(dealId);
  revalidatePath("/deals");
}

export async function addDealNoteAction(dealId: string, content: string) {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  await deleteNoteQuery(noteId);
  revalidatePath("/notes");
}

// ── Task actions ───────────────────────────────────────

export async function createTaskAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
  await updateTaskStatusQuery(taskId, status);
  revalidatePath("/tasks");
}

export async function deleteTaskAction(taskId: string) {
  await requireUser();
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
  await requireUser();
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

  if (!result.ok) {
    return result;
  }

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
  await requireUser();
  const { sendWhatsApp } = await import("@/lib/messaging/whatsapp");
  const result = await sendWhatsApp({ to, body });

  if (!result.ok) {
    return result;
  }

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
  await requireUser();
  const { sendSMS } = await import("@/lib/messaging/sms");
  const result = await sendSMS({ to, body });

  if (!result.ok) {
    return result;
  }

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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  const { deleteEmailTemplate } = await import("@/lib/queries");
  await deleteEmailTemplate(id);
  revalidatePath("/settings");
}

// ── Collaborateurs (allowlist d'inscription) ───────────

// Format volontairement permissif : la vraie validation, c'est que le
// destinataire reçoive le mail. On écarte juste les saisies manifestement fausses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteCollaboratorAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requireUser();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const note = String(formData.get("note") || "").trim() || null;

  if (!EMAIL_RE.test(email)) {
    return { ok: false, message: "Adresse email invalide." };
  }

  const { getAllowedEmailByAddress, createAllowedEmail } = await import("@/lib/queries");
  const existing = await getAllowedEmailByAddress(email);
  if (existing) {
    return { ok: false, message: "Cet email est déjà autorisé." };
  }

  await createAllowedEmail({ email, note });
  revalidatePath("/settings");

  const { sendInviteEmail } = await import("@/lib/messaging/invite");
  const sent = await sendInviteEmail(email);
  if (!sent.ok) {
    // L'autorisation est bien enregistrée : on ne la retire pas pour un échec
    // d'envoi, on dit juste qu'il faut transmettre le lien à la main.
    return {
      ok: true,
      message: `${email} est autorisé, mais l'email n'est pas parti (${sent.error}). Transmets-lui le lien /login à la main.`,
    };
  }

  return { ok: true, message: `Invitation envoyée à ${email}.` };
}

export async function removeAllowedEmailAction(id: string) {
  await requireUser();
  const { deleteAllowedEmail } = await import("@/lib/queries");
  await deleteAllowedEmail(id);
  revalidatePath("/settings");
}

// ── Data Import ────────────────────────────────────────

export async function bulkImportLeadsAction(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
) {
  await requireUser();
  const {
    createLead: createLeadQuery,
    getDefaultLeadStatus,
    getOrCreateContactForLead,
  } = await import("@/lib/queries");
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

      // Dédup contact (Phase 2) — set contactId sur le lead importé
      const contact = await getOrCreateContactForLead({
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        firstName: leadData.firstName || null,
        lastName: leadData.lastName || null,
        fullName: leadData.fullName,
      });

      await createLeadQuery({
        fullName: leadData.fullName,
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        phone: leadData.phone || null,
        organizationName: leadData.organizationName || null,
        jobTitle: leadData.jobTitle || null,
        website: leadData.website || null,
        statusId: defaultStatus?.id ?? null,
        contactId: contact.id,
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
  await requireUser();
  const { getOrCreateContactForLead } = await import("@/lib/queries");

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

      // Dédup contact (Phase 2) — remplace l'insertion brute
      await getOrCreateContactForLead({
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        firstName: leadData.firstName || null,
        lastName: leadData.lastName || null,
        fullName: leadData.fullName,
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
  await requireUser();
  const { markNotificationRead } = await import("@/lib/queries");
  await markNotificationRead(id);
  revalidatePath("/");
}

export async function markAllNotificationsReadAction() {
  await requireUser();
  const { markAllNotificationsRead } = await import("@/lib/queries");
  await markAllNotificationsRead();
  revalidatePath("/");
}

// ── Saved View actions ─────────────────────────────────

export async function saveViewAction(
  routeName: string,
  label: string,
  viewType: string,
  searchQuery: string,
  isPublic: boolean
) {
  await requireUser();
  const { createViewSetting } = await import("@/lib/queries");

  const filters = searchQuery ? { q: searchQuery } : null;
  const type = viewType === "kanban" ? "kanban" : "list";

  await createViewSetting({
    label,
    routeName,
    doctype: routeName,
    type: type as "list" | "kanban" | "group_by",
    filters: filters as never,
    public: isPublic,
    userId: null,
  });

  revalidatePath(`/${routeName}`);
}

export async function deleteViewAction(id: string, routeName: string) {
  await requireUser();
  const { deleteViewSetting } = await import("@/lib/queries");
  await deleteViewSetting(id);
  revalidatePath(`/${routeName}`);
}

// ── Connexion WordPress (thespace.academy) ─────────────

export async function saveWpConnectionAction(formData: FormData) {
  await requireUser();
  const { normalizeSiteUrl } = await import("@/lib/wordpress");

  const siteUrl = normalizeSiteUrl(String(formData.get("siteUrl") || ""));
  const username = String(formData.get("username") || "").trim();
  // Laissé vide = on conserve le mot de passe déjà en base.
  const appPassword = String(formData.get("appPassword") || "").trim();

  if (!siteUrl || !username) {
    return { ok: false, message: "URL du site et nom d'utilisateur obligatoires." };
  }

  const { saveWpConnection, getWpConnection } = await import("@/lib/queries");
  const existing = await getWpConnection();
  if (!appPassword && !existing) {
    return { ok: false, message: "App Password obligatoire à la première configuration." };
  }

  try {
    await saveWpConnection({ siteUrl, username, appPassword: appPassword || undefined });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Échec de l'enregistrement." };
  }

  revalidatePath("/settings");
  return { ok: true, message: "Connexion enregistrée." };
}

export async function testWpConnectionAction() {
  await requireUser();
  const { getWpConnection, recordWpConnectionTest } = await import("@/lib/queries");
  const { testWpConnection } = await import("@/lib/wordpress");

  const conn = await getWpConnection();
  if (!conn) return { ok: false, message: "Aucune connexion enregistrée." };

  const result = await testWpConnection({
    siteUrl: conn.siteUrl,
    username: conn.username,
    appPassword: conn.appPassword,
  });

  await recordWpConnectionTest(result.ok, result.message);
  revalidatePath("/settings");
  return result;
}

// ── Lien formation ↔ formulaire Elementor ──────────────

/** Liste les formulaires du site + indique lesquels sont déjà pris. */
export async function listElementorFormsAction() {
  await requireUser();
  const { getWpConnection, getLinkedElementorForms } = await import("@/lib/queries");
  const { listElementorForms } = await import("@/lib/wordpress");

  const conn = await getWpConnection();
  if (!conn) {
    return { ok: false as const, message: "Connexion au site non configurée (Settings → Site).", forms: [] };
  }

  try {
    const forms = await listElementorForms({
      siteUrl: conn.siteUrl,
      username: conn.username,
      appPassword: conn.appPassword,
    });
    const linked = await getLinkedElementorForms();
    const takenBy = new Map(
      linked.map((l) => [l.elementorFormId, l.bootcampName ?? "une autre formation"])
    );
    return {
      ok: true as const,
      message: "",
      forms: forms.map((f) => ({ ...f, takenBy: takenBy.get(f.id) ?? null })),
    };
  } catch (e) {
    return {
      ok: false as const,
      message: e instanceof Error ? e.message : "Lecture des formulaires impossible.",
      forms: [],
    };
  }
}

export async function linkElementorFormAction(
  bootcampId: string,
  elementorFormId: string,
  label: string
) {
  await requireUser();
  const { getWpConnection, linkElementorForm } = await import("@/lib/queries");
  const { getLatestSubmissionId } = await import("@/lib/wordpress");

  const conn = await getWpConnection();
  if (!conn) return { ok: false, message: "Connexion au site non configurée." };

  // Curseur posé sur la dernière soumission existante : l'historique déjà
  // stocké côté WordPress n'est PAS importé, seulement les suivantes.
  let cursor: number | null = null;
  try {
    cursor = await getLatestSubmissionId(
      { siteUrl: conn.siteUrl, username: conn.username, appPassword: conn.appPassword },
      elementorFormId
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Site injoignable." };
  }

  // Tire la dernière soumission pour proposer un mapping de départ et afficher
  // les vraies clés du formulaire dans l'éditeur (sinon mapping à l'aveugle).
  let seedMapping: Record<string, string> = {};
  let seedPayload: Record<string, string> | null = null;
  if (cursor) {
    try {
      const { listSubmissionsAfter } = await import("@/lib/wordpress");
      const { guessFieldMapping } = await import("@/lib/elementor-import");
      const [sample] = await listSubmissionsAfter(
        { siteUrl: conn.siteUrl, username: conn.username, appPassword: conn.appPassword },
        elementorFormId,
        cursor - 1,
        1
      );
      if (sample) {
        seedPayload = sample.values;
        seedMapping = guessFieldMapping(sample.values);
      }
    } catch {
      // Pas bloquant : le lien se fait, le mapping se remplira à la main.
    }
  }

  try {
    await linkElementorForm({
      bootcampId,
      elementorFormId,
      name: label,
      lastSubmissionId: cursor,
      fieldMapping: seedMapping,
      lastPayload: seedPayload,
    });
  } catch (e) {
    // 23505 = l'index unique partiel a refusé : le formulaire est pris ailleurs.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("form_sources_elementor_form_active_key")) {
      return { ok: false, message: "Ce formulaire alimente déjà une autre formation. Déliez-le d'abord." };
    }
    return { ok: false, message: msg || "Échec du lien." };
  }

  revalidatePath(`/bootcamps/${bootcampId}`);
  return {
    ok: true,
    message: cursor
      ? `Lié. Les soumissions à partir de maintenant arriveront ici (historique ignoré, curseur #${cursor}).`
      : "Lié. Ce formulaire n'a encore aucune soumission.",
  };
}

export async function unlinkElementorFormAction(sourceId: string, bootcampId: string) {
  await requireUser();
  const { unlinkElementorForm } = await import("@/lib/queries");
  await unlinkElementorForm(sourceId);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true, message: "Formulaire délié." };
}

export async function setElementorMappingAction(
  sourceId: string,
  bootcampId: string,
  mapping: Record<string, string>
) {
  await requireUser();
  const { setFieldMapping } = await import("@/lib/queries");
  // Whitelist : on n'accepte que des colonnes connues (jamais statusId, bootcampId…)
  const { MAPPABLE_FIELDS } = await import("@/lib/lead-intake");
  const allowed = new Set<string>(MAPPABLE_FIELDS as readonly string[]);
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapping)) {
    if (v && allowed.has(v)) clean[k] = v;
  }
  await setFieldMapping(sourceId, clean);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true, message: "Mapping enregistré." };
}

/** Import manuel « maintenant » pour une source. */
export async function importElementorNowAction(sourceId: string, bootcampId: string) {
  await requireUser();
  const { getWpConnection, getFormSourceById } = await import("@/lib/queries");
  const { importElementorSource } = await import("@/lib/elementor-import");

  const [conn, source] = await Promise.all([getWpConnection(), getFormSourceById(sourceId)]);
  if (!conn) return { ok: false, message: "Connexion au site non configurée." };
  if (!source) return { ok: false, message: "Source introuvable." };

  const r = await importElementorSource(source, {
    siteUrl: conn.siteUrl,
    username: conn.username,
    appPassword: conn.appPassword,
  });

  revalidatePath(`/bootcamps/${bootcampId}`);
  if (r.error) return { ok: false, message: `${r.error} (${r.created} créé(s) avant l'erreur)` };
  if (r.fetched === 0) return { ok: true, message: "Aucune nouvelle soumission." };
  const base = `${r.fetched} soumission(s) — ${r.created} lead(s) créé(s), ${r.updated} mis à jour`;
  if (r.skipped > 0) {
    return {
      ok: true,
      message:
        `${base}, ${r.skipped} ignorée(s) faute d'email ET de téléphone ` +
        `(#${r.skippedIds.join(", #")}). Elles restent lisibles côté WordPress.`,
    };
  }
  return { ok: true, message: `${base}.` };
}

/** Colonne d'arrivée + tags par défaut d'un formulaire Elementor lié. */
export async function setElementorRoutingAction(
  sourceId: string,
  bootcampId: string,
  targetStatusId: string | null,
  tagIds: string[]
) {
  await requireUser();
  const { setFormSourceRouting, getLeadStatuses, getTags } = await import("@/lib/queries");

  // La colonne doit appartenir au pipeline de CETTE formation, et ne peut pas
  // être terminale : un import ne doit jamais poser un lead directement en
  // « Inscrit » (l'inscription passe par enrollLeadAction, pas par le webhook).
  if (targetStatusId) {
    const stages = await getLeadStatuses(bootcampId);
    const target = stages.find((s) => s.id === targetStatusId);
    if (!target) return { ok: false, message: "Colonne inconnue pour cette formation." };
    if (target.kind !== "normal") {
      return { ok: false, message: "Une colonne terminale ne peut pas être la colonne d'arrivée." };
    }
  }

  // Whitelist des tags : on n'écrit que des ids qui existent réellement.
  const known = new Set((await getTags()).map((t) => t.id));
  const clean = tagIds.filter((id) => known.has(id));

  await setFormSourceRouting(sourceId, targetStatusId || null, clean);
  revalidatePath(`/bootcamps/${bootcampId}`);
  return { ok: true, message: "Routage enregistré." };
}

// ── Tags ───────────────────────────────────────────────

// Palette alignée sur STATUS_COLORS (src/lib/utils.ts) : un tag ne peut porter
// qu'une couleur que l'UI sait effectivement rendre.
const TAG_COLORS = [
  "gray", "blue", "purple", "green", "dark-green", "red", "orange", "amber",
];

export async function createTagAction(name: string, color: string) {
  await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom requis." };
  if (clean.length > 40) return { ok: false, message: "40 caractères maximum." };
  const safeColor = TAG_COLORS.includes(color) ? color : "gray";

  const { createTag } = await import("@/lib/queries");
  try {
    await createTag({ name: clean, color: safeColor });
  } catch (e) {
    // `tags.name` est UNIQUE : on renvoie un message clair plutôt qu'un crash.
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("tags_name_unique") || msg.includes("duplicate key")) {
      return { ok: false, message: `Le tag « ${clean} » existe déjà.` };
    }
    return { ok: false, message: "Création impossible." };
  }
  revalidatePath("/tags");
  return { ok: true, message: `Tag « ${clean} » créé.` };
}

export async function updateTagAction(id: string, name: string, color: string) {
  await requireUser();
  const clean = name.trim();
  if (!clean) return { ok: false, message: "Nom requis." };
  const safeColor = TAG_COLORS.includes(color) ? color : "gray";

  const { updateTag } = await import("@/lib/queries");
  try {
    await updateTag(id, { name: clean, color: safeColor });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("tags_name_unique") || msg.includes("duplicate key")) {
      return { ok: false, message: `Le tag « ${clean} » existe déjà.` };
    }
    return { ok: false, message: "Modification impossible." };
  }
  revalidatePath("/tags");
  return { ok: true, message: "Tag mis à jour." };
}

export async function deleteTagAction(id: string) {
  await requireUser();
  const { deleteTag, getAllFormSources, setFormSourceTagIds } = await import("@/lib/queries");

  // `lead_tags` part en cascade (FK ON DELETE CASCADE). En revanche
  // `form_sources.default_tag_ids` est un jsonb SANS clé étrangère : rien ne le
  // nettoie tout seul, un tag supprimé y resterait comme id fantôme.
  // Fait en JS plutôt qu'en SQL jsonb : lisible, testable, et indépendant des
  // subtilités de paramétrage entre Drizzle et postgres-js.
  for (const fs of await getAllFormSources()) {
    const ids = (fs.defaultTagIds ?? []) as string[];
    if (ids.includes(id)) {
      await setFormSourceTagIds(fs.id, ids.filter((x) => x !== id));
    }
  }

  await deleteTag(id);
  revalidatePath("/tags");
  return { ok: true, message: "Tag supprimé." };
}

/** Pose ou retire un tag sur un lead. */
export async function toggleLeadTagAction(leadId: string, tagId: string, on: boolean) {
  await requireUser();
  const { attachTagToLead, detachTagFromLead } = await import("@/lib/queries");
  if (on) await attachTagToLead(leadId, tagId);
  else await detachTagFromLead(leadId, tagId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true, message: "" };
}

/** Appelée au montage de la fiche lead : éteint le marqueur « non traité ». */
export async function markLeadSeenAction(leadId: string) {
  await requireUser();
  const { markLeadSeen } = await import("@/lib/queries");
  await markLeadSeen(leadId);
  // Pas de revalidatePath ici : la fiche vient d'être rendue, et revalider
  // relancerait un rendu complet pour un simple changement de marqueur.
  // Le board se met à jour à sa prochaine visite.
}

export async function setBootcampArchivedAction(bootcampId: string, archived: boolean) {
  await requireUser();
  const { setBootcampArchived } = await import("@/lib/queries");
  await setBootcampArchived(bootcampId, archived);
  revalidatePath("/bootcamps");
  revalidatePath(`/bootcamps/${bootcampId}`);
  return {
    ok: true,
    message: archived
      ? "Formation archivée. Ses formulaires n'importent plus de leads."
      : "Formation désarchivée.",
  };
}

// ── Doublons d'adresse email entre leads ───────────────

export async function dismissDuplicateAction(leadId: string) {
  await requireUser();
  const { dismissDuplicate } = await import("@/lib/duplicates");
  await dismissDuplicate(leadId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: true as const };
}

export async function separateLeadAction(leadId: string) {
  await requireUser();
  const { separateLeadFromContact } = await import("@/lib/duplicates");
  const r = await separateLeadFromContact(leadId);
  revalidatePath(`/leads/${leadId}`);
  return r;
}
