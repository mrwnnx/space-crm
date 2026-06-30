import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadStatuses, formSources, contacts } from "@/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import {
  getOrCreateContactForLead,
  recordStageChange,
  attachTagToLead,
  createActivity,
} from "@/lib/queries";

// ── Webhook formulaires Elementor (public, hors proxy) ──
// Auth = token par form_source + champ active. PAS de requireUser() ici :
// ce endpoint est joignable sans session (exclu du proxy via /api/webhook/*).
// La sécurité repose sur l'unicité du webhookToken (UNIQUE en DB) et active=false
// qui désactive un formulaire compromis sans toucher le reste.

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 Ko

// Whitelist stricte des colonnes lead acceptées depuis le payload.
// JAMAIS de converted, statusId, owner, bootcampId… depuis le payload.
const ALLOWED_LEAD_FIELDS = [
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
const CONTACT_EXTRA_FIELDS = ["whatsapp", "age"] as const;
const LEAD_EXTRA_FIELDS = ["intendedPlan", "promoCode"] as const;

// Dérive le plan de paiement (enum total|monthly) depuis le texte d'un champ de choix.
// Ex Tally : "Paiement total: 1300dt" → total ; "Paiement facilité: 400dt /mois" → monthly.
function derivePlan(raw?: string): "total" | "monthly" | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("total")) return "total";
  if (s.includes("facilit") || s.includes("mois") || s.includes("/mo")) return "monthly";
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Résoudre le token → form_source actif
    const formSource = await db.query.formSources.findFirst({
      where: and(
        eq(formSources.webhookToken, token),
        eq(formSources.active, true)
      ),
    });

    if (!formSource) {
      // 404 — ne divulgue pas si le token existe mais inactif
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 2. Cap taille payload
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    // 3. Parse le body selon le content-type
    const contentType = request.headers.get("content-type") || "";
    let rawValues: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const text = await request.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      try {
        const parsed = JSON.parse(text);
        rawValues = parsePayload(parsed);
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    } else {
      // form-urlencoded ou multipart/form-data
      const text = await request.text();
      if (text.length > MAX_PAYLOAD_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      const fakeReq = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: text,
      });
      try {
        const formData = await fakeReq.formData();
        for (const [key, val] of formData) {
          rawValues[key] = String(val);
        }
      } catch {
        return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
      }
    }

    // 3.5 Capture le dernier payload BRUT reçu sur le formulaire (aide au mapping).
    // Indépendant de la dédup lead → reflète exactement ce qu'Elementor envoie.
    await db
      .update(formSources)
      .set({ lastPayload: rawValues, lastReceivedAt: new Date() })
      .where(eq(formSources.id, formSource.id));

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
        // Garde la 1re valeur non vide (ex. 2 clés Tally "Paiement" → intendedPlan).
        if (val && !extra[targetCol]) extra[targetCol] = val;
      }
    }

    // Coercition des champs étendus
    const whatsapp = extra.whatsapp || null;
    const ageParsed = extra.age ? parseInt(extra.age, 10) : NaN;
    const age = Number.isFinite(ageParsed) ? ageParsed : null;
    const intendedPlan = derivePlan(extra.intendedPlan);
    const promoCode = extra.promoCode || null;

    // 5. Compose fullName si absent
    if (!leadData.fullName) {
      const parts = [leadData.firstName, leadData.lastName].filter(Boolean);
      if (parts.length > 0) leadData.fullName = parts.join(" ");
    }

    // Exige au moins email OU mobileNo
    if (!leadData.email && !leadData.mobileNo) {
      return NextResponse.json(
        { error: "Email or mobile required" },
        { status: 422 }
      );
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
          rawPayload,
          stageEnteredAt: new Date(),
          lastContactedAt: new Date(),
        })
        .returning();
      leadId = newLead.id;

      await recordStageChange(leadId, null, targetStatusId, "webhook");
    } else {
      // UPDATE non destructif
      leadId = existingLead.id;

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
      const leadExtraUpdate: { intendedPlan?: "total" | "monthly"; promoCode?: string } = {};
      if (intendedPlan && !existingLead.intendedPlan) leadExtraUpdate.intendedPlan = intendedPlan;
      if (promoCode && !existingLead.promoCode) leadExtraUpdate.promoCode = promoCode;

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
      content: leadData.email || leadData.mobileNo || "",
    });

    // 10. Réponse rapide
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/forms] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Choisit le parseur selon la forme du JSON reçu.
// Tally envoie { data: { fields: [{ key, label, type, value }] } } → on mappe par `key`
// stable (insensible à l'ordre des champs). Sinon (Elementor & autres), on aplatit.
function parsePayload(parsed: unknown): Record<string, string> {
  const fields = (parsed as { data?: { fields?: unknown } })?.data?.fields;
  if (Array.isArray(fields)) {
    const result: Record<string, string> = {};
    for (const f of fields) {
      const field = f as {
        key?: unknown;
        value?: unknown;
        options?: Array<{ id?: unknown; text?: unknown }>;
      };
      if (typeof field.key !== "string") continue;
      let value = field.value;
      // Champs à choix (MULTIPLE_CHOICE/dropdown) : value = id(s) d'option.
      // On résout l'id en son texte via options[] (sinon derivePlan reçoit un UUID).
      // Fallback : si l'id n'est pas trouvé, on garde la valeur brute (rien ne casse).
      if (Array.isArray(field.options) && field.options.length > 0) {
        const idToText = new Map<string, string>();
        for (const o of field.options) {
          if (o && o.id != null) idToText.set(String(o.id), String(o.text ?? ""));
        }
        const resolve = (x: unknown) => idToText.get(String(x)) ?? String(x);
        value = Array.isArray(value) ? value.map(resolve) : resolve(value);
      }
      result[field.key] =
        value == null ? "" : Array.isArray(value) ? value.join(", ") : String(value);
    }
    return result;
  }
  return flattenJson(parsed);
}

// Aplatit un JSON nested en notation crochet "parent[child]" (format Elementor)
// pour que les clés matchent le fieldMapping configuré pour les formulaires Elementor.
function flattenJson(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj === null || obj === undefined) return result;
  if (typeof obj !== "object") {
    if (prefix) result[prefix] = String(obj);
    return result;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      Object.assign(result, flattenJson(item, `${prefix}[${i}]`));
    });
    return result;
  }
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (val !== null && typeof val === "object") {
      Object.assign(result, flattenJson(val, fullKey));
    } else {
      result[fullKey] = String(val ?? "");
    }
  }
  return result;
}
