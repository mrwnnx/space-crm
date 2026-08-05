import "server-only";
import { db } from "@/db";
import { formSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingestSubmission } from "@/lib/lead-intake";
import { listSubmissionsAfter, type WpCredentials } from "@/lib/wordpress";

// Import « pull » des soumissions Elementor vers les leads.
// Le curseur (last_submission_id) avance soumission par soumission : une erreur
// au milieu du lot n'oblige pas à tout rejouer, et rien n'est importé deux fois.

export type ImportReport = {
  sourceId: string;
  sourceName: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
};

export async function importElementorSource(
  source: typeof formSources.$inferSelect,
  creds: WpCredentials,
  maxFetch = 100
): Promise<ImportReport> {
  const report: ImportReport = {
    sourceId: source.id,
    sourceName: source.name,
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
  };

  if (!source.elementorFormId) {
    report.error = "Source sans formulaire Elementor.";
    return report;
  }

  let submissions;
  try {
    submissions = await listSubmissionsAfter(
      creds,
      source.elementorFormId,
      source.lastSubmissionId ?? null,
      maxFetch
    );
  } catch (e) {
    report.error = e instanceof Error ? e.message : "Lecture des soumissions impossible.";
    return report;
  }

  report.fetched = submissions.length;

  for (const sub of submissions) {
    try {
      const result = await ingestSubmission(source, sub.values, {
        activityContentFallback: `Soumission Elementor #${sub.id}`,
      });
      if (result.ok) {
        if (result.created) report.created++;
        else report.updated++;
      } else {
        // Ni email ni téléphone exploitable — typiquement un mapping incomplet.
        report.skipped++;
      }
    } catch (e) {
      report.error = e instanceof Error ? e.message : "Erreur d'import.";
      break; // on garde le curseur là où il en est
    }

    // Curseur + dernier payload après CHAQUE soumission traitée.
    await db
      .update(formSources)
      .set({
        lastSubmissionId: sub.id,
        lastPayload: sub.values,
        lastReceivedAt: new Date(),
      })
      .where(eq(formSources.id, source.id));
  }

  return report;
}

/**
 * Devine un mapping de départ à partir des clés d'une soumission réelle.
 * Ne couvre que les clés lisibles (`email`, `name`, `lastname`…) — les
 * `field_xxxxx` opaques d'Elementor restent à mapper à la main.
 */
export function guessFieldMapping(values: Record<string, string>): Record<string, string> {
  const keys = Object.keys(values);
  const has = (k: string) => keys.includes(k);
  const mapping: Record<string, string> = {};

  for (const key of keys) {
    const k = key.toLowerCase();
    if (k === "email" || k.includes("email")) mapping[key] = "email";
    else if (k === "lastname" || k === "last_name" || k === "nom") mapping[key] = "lastName";
    else if (k === "name" || k === "prenom" || k === "firstname" || k === "first_name") {
      // "name" seul = nom complet ; "name" + "lastname" = prénom.
      mapping[key] = has("lastname") || has("last_name") ? "firstName" : "fullName";
    } else if (k.includes("whatsapp")) mapping[key] = "whatsapp";
    else if (k.includes("phone") || k.includes("tel")) mapping[key] = "mobileNo";
  }
  return mapping;
}
