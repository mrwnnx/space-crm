import "server-only";
import {
  createLead,
  getEntryLeadStatus,
  getOrCreateContactForLead,
  getOrCreateTagByName,
  findLeadIdByContact,
  attachTagToLead,
  completeFromImport,
} from "@/lib/queries";

// Cœur de l'import CSV, sans authentification ni revalidation : les actions serveur l'enveloppent,
// et un script peut l'appeler directement pour le tester.

// Une ligne devient un jeu de champs ; le nom se déduit de prénom+nom.
function importRowToFields(row: Record<string, string>, fieldMapping: Record<string, string>) {
  const d: Record<string, string | null> = {};
  for (const [csvCol, fieldName] of Object.entries(fieldMapping)) {
    if (fieldName && row[csvCol] !== undefined) {
      d[fieldName] = row[csvCol].trim() || null;
    }
  }
  const email = d.email?.toLowerCase() || null;
  const firstName = d.firstName || null;
  const lastName = d.lastName || null;
  // Le nom que la ligne donne vraiment (peut être vide) — le repli sur l'email se décide après la dédup.
  const fullName = d.fullName || [firstName, lastName].filter(Boolean).join(" ") || null;
  // Un seul numéro : en Tunisie « téléphone » est toujours un mobile, et seul Mobile
  // s'affiche (fiche, kanban, digest, WhatsApp). Un numéro rangé dans Téléphone est
  // invisible — 666 leads le 2026-09-18. Téléphone ne garde qu'un second numéro distinct.
  const mobileNo = d.mobileNo || d.phone || null;
  const phone = d.phone && d.phone !== mobileNo ? d.phone : null;
  return {
    email,
    firstName,
    lastName,
    fullName,
    mobileNo,
    phone,
    organizationName: d.organizationName || null,
    jobTitle: d.jobTitle || null,
    website: d.website || null,
  };
}

export type BulkImportResult = {
  created: number;
  existing: number;
  skipped: number;
  errors: number;
  total: number;
  firstError?: string; // la première erreur rencontrée, pour ne pas échouer en silence
};

export type BulkImportLeadsOptions = {
  tagId?: string | null; // tag existant à poser sur chaque lead (créé ou retrouvé)
  newTagName?: string | null; // ou un nouveau tag, par son nom
  bootcampId?: string | null; // formation de destination ; null = hors kanban (base de contacts)
};

export async function importLeads(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>,
  opts?: BulkImportLeadsOptions
): Promise<BulkImportResult> {
  let tagId = opts?.tagId || null;
  if (!tagId && opts?.newTagName?.trim()) {
    tagId = (await getOrCreateTagByName(opts.newTagName)).id;
  }
  // Une formation → sa colonne d'entrée ; aucune → ni formation ni colonne, le lead reste hors des kanbans.
  const bootcampId = opts?.bootcampId || null;
  const statusId = bootcampId ? ((await getEntryLeadStatus(bootcampId))?.id ?? null) : null;

  let created = 0;
  let existing = 0;
  let skipped = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (const row of rows) {
    try {
      const d = importRowToFields(row, fieldMapping);
      if (!d.fullName && !d.email) {
        skipped++;
        continue;
      }

      const contact = await getOrCreateContactForLead({
        email: d.email,
        mobileNo: d.mobileNo,
        firstName: d.firstName,
        lastName: d.lastName,
        fullName: d.fullName || d.email!,
      });

      // Déjà un lead pour cette personne → pas de doublon : on pose le tag, le numéro du CSV
      // remplace l'ancien (le fichier est plus récent), le reste ne remplit que ce qui manque.
      const existingLeadId = await findLeadIdByContact(contact.id);
      if (existingLeadId) {
        if (tagId) await attachTagToLead(existingLeadId, tagId);
        await completeFromImport(existingLeadId, contact.id, d);
        existing++;
        continue;
      }

      // Un contact déjà connu en sait souvent plus que la ligne : le lead hérite de ce que le CSV ne donne pas.
      const lead = await createLead({
        fullName: d.fullName || contact.fullName,
        firstName: d.firstName || contact.firstName,
        email: d.email || contact.email,
        mobileNo: d.mobileNo || contact.mobileNo,
        phone: d.phone,
        organizationName: d.organizationName,
        jobTitle: d.jobTitle,
        website: d.website,
        statusId,
        bootcampId,
        contactId: contact.id,
      });
      if (tagId) await attachTagToLead(lead.id, tagId);
      created++;
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (!firstError) firstError = msg;
      console.error("[import leads]", msg);
    }
  }

  return { created, existing, skipped, errors, total: rows.length, firstError };
}

export async function importContacts(
  rows: Record<string, string>[],
  fieldMapping: Record<string, string>
): Promise<BulkImportResult> {
  let created = 0;
  let skipped = 0;
  let errors = 0;
  let firstError: string | undefined;

  for (const row of rows) {
    try {
      const d = importRowToFields(row, fieldMapping);
      if (!d.fullName && !d.email) {
        skipped++;
        continue;
      }

      // Dédup contact (Phase 2) — remplace l'insertion brute
      await getOrCreateContactForLead({
        email: d.email,
        mobileNo: d.mobileNo,
        firstName: d.firstName,
        lastName: d.lastName,
        fullName: d.fullName || d.email!,
      });
      created++;
    } catch (e) {
      errors++;
      const msg = e instanceof Error ? e.message : String(e);
      if (!firstError) firstError = msg;
      console.error("[import contacts]", msg);
    }
  }

  return { created, existing: 0, skipped, errors, total: rows.length, firstError };
}
