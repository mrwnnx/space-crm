import "server-only";
import { db } from "@/db";
import { leads, leadStatuses, contacts, formSources } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  getOrCreateContactForLead,
  recordStageChange,
  attachTagToLead,
  createActivity,
} from "@/lib/queries";

// Transformation « payload d'un formulaire → lead ».
// Extrait de app/api/webhook/forms/[token]/route.ts pour être partagé entre
// le webhook générique (push) et l'import Elementor (pull par API).
// Le comportement est identique des deux côtés — c'est tout l'intérêt.

// Whitelist stricte des colonnes lead acceptées depuis le payload.
// JAMAIS de converted, statusId, owner, bootcampId… depuis le payload.
export const ALLOWED_LEAD_FIELDS = [
  "email",
  "fullName",
  "firstName",
  "lastName",
  "mobileNo",
  "phone",
  "jobTitle",
  "organizationName",
] as const;

// Champs étendus hors whitelist lead : vont sur le contact (whatsapp, age)
// ou sur le lead avec coercition (intendedPlan dérivé d'un texte, promoCode).
export const CONTACT_EXTRA_FIELDS = ["whatsapp", "age"] as const;
export const LEAD_EXTRA_FIELDS = ["intendedPlan", "promoCode", "motivation", "wantsCall"] as const;

/** Colonnes proposables dans un éditeur de mapping. */
export const MAPPABLE_FIELDS = [
  ...ALLOWED_LEAD_FIELDS,
  ...CONTACT_EXTRA_FIELDS,
  ...LEAD_EXTRA_FIELDS,
] as const;

// Dérive le plan de paiement (enum total|monthly) depuis le texte d'un champ de choix.
//
// ⚠️ Ne chercher QUE le mot « total » a coûté cher : l'option réelle du
// formulaire est « Payer maintenant = 1299 dt », qui ne le contient pas. Les 17
// leads prêts à payer comptant — les meilleurs — sont restés sans offre, ce qui
// s'est propagé aux emails, à la file du jour et à la qualification IA.
// Le libellé d'un formulaire change ; la liste ci-dessous doit rester large.
export function derivePlan(raw?: string): "total" | "monthly" | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  // Le mensuel d'abord : ses marqueurs sont plus spécifiques.
  if (/facilit|mois|mensuel|tranche|\/mo\b/.test(s)) return "monthly";
  if (/total|maintenant|comptant|cash|une seule fois|intégral|integral/.test(s)) {
    return "total";
  }
  return null;
}

// Dérive un booléen depuis la réponse d'un champ de choix oui/non.
// Le formulaire est bilingue (FR + derija) : « OUI » / « نعم » → true.
export function deriveYesNo(raw?: string): boolean | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^(oui|yes|o|y)\b/.test(s) || s.startsWith("نعم") || s.startsWith("إيه") || s.startsWith("ايه")) return true;
  if (/^(non|no|n)\b/.test(s) || s.startsWith("لا")) return false;
  return null;
}

export type IngestResult =
  | { ok: true; leadId: string; created: boolean }
  | { ok: false; reason: "missing_identity" };

export async function ingestSubmission(
  formSource: typeof formSources.$inferSelect,
  rawValues: Record<string, string>,
  opts?: { activityContentFallback?: string }
): Promise<IngestResult> {
  // 4. Mappe via fieldMapping avec whitelist stricte
  const fieldMapping = (formSource.fieldMapping ?? {}) as Record<string, string>;
  const leadData: Record<string, string> = {};
  const extra: Record<string, string> = {};
  for (const [incomingKey, targetCol] of Object.entries(fieldMapping)) {
    const incoming = rawValues[incomingKey];
    if (!targetCol || incoming === undefined) continue;
    const val = String(incoming).trim();
    if ((ALLOWED_LEAD_FIELDS as readonly string[]).includes(targetCol)) {
      leadData[targetCol] = val;
    } else if (
      (CONTACT_EXTRA_FIELDS as readonly string[]).includes(targetCol) ||
      (LEAD_EXTRA_FIELDS as readonly string[]).includes(targetCol)
    ) {
      // Garde la 1re valeur non vide (ex. 2 clés distinctes → intendedPlan).
      if (val && !extra[targetCol]) extra[targetCol] = val;
    }
  }

  // Coercition des champs étendus
  const whatsapp = extra.whatsapp || null;
  const ageParsed = extra.age ? parseInt(extra.age, 10) : NaN;
  const age = Number.isFinite(ageParsed) ? ageParsed : null;
  const intendedPlan = derivePlan(extra.intendedPlan);
  const promoCode = extra.promoCode || null;
  const motivation = extra.motivation || null;
  const wantsCall = deriveYesNo(extra.wantsCall);

  // 5. Compose fullName si absent
  if (!leadData.fullName) {
    const parts = [leadData.firstName, leadData.lastName].filter(Boolean);
    if (parts.length > 0) leadData.fullName = parts.join(" ");
  }

  // Exige au moins email OU mobileNo
  if (!leadData.email && !leadData.mobileNo) {
    return { ok: false, reason: "missing_identity" };
  }

  // 6. Contact dédupliqué (whatsapp/age posés à la création)
  const contact = await getOrCreateContactForLead({
    email: leadData.email || null,
    mobileNo: leadData.mobileNo || null,
    firstName: leadData.firstName || null,
    lastName: leadData.lastName || null,
    fullName: leadData.fullName || "",
    whatsapp,
    age,
  });

  // 6.5 Enrichit un contact EXISTANT si whatsapp/age étaient vides (re-soumission)
  const contactPatch: { whatsapp?: string; age?: number } = {};
  if (whatsapp && !contact.whatsapp) contactPatch.whatsapp = whatsapp;
  if (age !== null && contact.age === null) contactPatch.age = age;
  if (Object.keys(contactPatch).length > 0) {
    await db.update(contacts).set(contactPatch).where(eq(contacts.id, contact.id));
  }

  // 7. Upsert lead par (bootcampId, lower(trim(email)))
  const bootcampId = formSource.bootcampId!;
  const emailNorm = leadData.email ? leadData.email.trim().toLowerCase() : null;

  let existingLead: typeof leads.$inferSelect | undefined;

  if (emailNorm) {
    const matches = await db.query.leads.findMany({
      where: and(
        eq(leads.bootcampId, bootcampId),
        sql`lower(trim(coalesce(${leads.email}, ''))) = ${emailNorm}`
      ),
      limit: 1,
    });
    existingLead = matches[0];
  }

  // Résous le statusId cible (pour la création)
  let targetStatusId = formSource.targetStatusId;
  if (!targetStatusId) {
    const normalStages = await db.query.leadStatuses.findMany({
      where: and(
        eq(leadStatuses.bootcampId, bootcampId),
        eq(leadStatuses.kind, "normal")
      ),
      orderBy: [asc(leadStatuses.position)],
    });
    targetStatusId = normalStages[0]?.id ?? null;
  }

  const rawPayload = { payload: rawValues, receivedAt: new Date().toISOString() };
  let leadId: string;
  let created: boolean;

  if (!existingLead) {
    // CREATE
    const [newLead] = await db
      .insert(leads)
      .values({
        bootcampId,
        contactId: contact.id,
        formSourceId: formSource.id,
        statusId: targetStatusId,
        temperature: (formSource.temperature as "hot" | "cold") ?? "cold",
        fullName: leadData.fullName || contact.fullName,
        firstName: leadData.firstName || null,
        lastName: leadData.lastName || null,
        email: leadData.email || null,
        mobileNo: leadData.mobileNo || null,
        phone: leadData.phone || null,
        jobTitle: leadData.jobTitle || null,
        organizationName: leadData.organizationName || null,
        intendedPlan: intendedPlan ?? undefined,
        promoCode: promoCode ?? undefined,
        motivation: motivation ?? undefined,
        wantsCall: wantsCall ?? undefined,
        rawPayload,
        stageEnteredAt: new Date(),
        lastContactedAt: new Date(),
      })
      .returning();
    leadId = newLead.id;
    created = true;

    await recordStageChange(leadId, null, targetStatusId, "webhook");

    // Un lead déposé par l'import entre bien dans une colonne : il déclenche
    // les mêmes automatisations qu'un déplacement à la main.
    // ⚠️ Uniquement à la CRÉATION — une re-soumission ne redéplace pas le lead
    // (statusId n'est jamais réécrit plus bas), donc pas de doublon d'email.
    const { runStatusAutomations } = await import("@/lib/automations");
    await runStatusAutomations(leadId, targetStatusId);
  } else {
    // UPDATE non destructif
    leadId = existingLead.id;
    created = false;

    // Merge rawPayload : garde l'ancien, ajoute le nouveau sous une clé datée
    const prevPayload = (existingLead.rawPayload as Record<string, unknown> | null) ?? {};
    const mergeKey = `submission_${new Date().toISOString()}`;
    const mergedPayload = { ...prevPayload, [mergeKey]: rawValues };

    // Temperature : upgrade cold→hot UNIQUEMENT (jamais hot→cold)
    const temperatureUpdate: { temperature?: "hot" } = {};
    if (existingLead.temperature === "cold" && formSource.temperature === "hot") {
      temperatureUpdate.temperature = "hot";
    }

    // Remplit l'offre / code promo seulement s'ils étaient vides (non destructif)
    const leadExtraUpdate: {
      intendedPlan?: "total" | "monthly";
      promoCode?: string;
      motivation?: string;
      wantsCall?: boolean;
    } = {};
    if (intendedPlan && !existingLead.intendedPlan) leadExtraUpdate.intendedPlan = intendedPlan;
    if (promoCode && !existingLead.promoCode) leadExtraUpdate.promoCode = promoCode;
    if (motivation && !existingLead.motivation) leadExtraUpdate.motivation = motivation;
    if (wantsCall !== null && existingLead.wantsCall === null) leadExtraUpdate.wantsCall = wantsCall;

    await db
      .update(leads)
      .set({
        lastContactedAt: new Date(),
        rawPayload: mergedPayload,
        updatedAt: new Date(),
        ...temperatureUpdate,
        ...leadExtraUpdate,
        // NE déplace PAS statusId (respect du placement manuel)
        // NE PAS écraser formSourceId s'il est déjà set
      })
      .where(eq(leads.id, leadId));
  }

  // 8. Tags : attache source.defaultTagIds (onConflictDoNothing)
  const tagIds = (formSource.defaultTagIds as string[] | null) ?? [];
  for (const tagId of tagIds) {
    await attachTagToLead(leadId, tagId);
  }

  // 9. Journalise une activity type 'webhook_in'
  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "webhook_in",
    direction: "inbound",
    subject: formSource.name,
    content: leadData.email || leadData.mobileNo || opts?.activityContentFallback || "",
    // Explicite : un lead arrivé du site reste « Import automatique », même
    // quand c'est un humain qui a cliqué sur « Importer ».
    createdBy: "webhook",
  });

  return { ok: true, leadId, created };
}
