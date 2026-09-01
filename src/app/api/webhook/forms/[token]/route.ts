import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { formSources } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ingestSubmission } from "@/lib/lead-intake";

// ── Webhook formulaires Elementor (public, hors proxy) ──
// Auth = token par form_source + champ active. PAS de requireUser() ici :
// ce endpoint est joignable sans session (exclu du proxy via /api/webhook/*).
// La sécurité repose sur l'unicité du webhookToken (UNIQUE en DB) et active=false
// qui désactive un formulaire compromis sans toucher le reste.

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100 Ko

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

    // 4→9. Mapping, contact, upsert lead, tags, activity — logique partagée
    // avec l'import Elementor (src/lib/lead-intake.ts).
    const result = await ingestSubmission(formSource, rawValues);
    if (!result.ok) {
      return NextResponse.json({ error: "Email or mobile required" }, { status: 422 });
    }

    // 10. Réponse rapide
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/forms] error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Le webhook accepte du JSON générique : on aplatit en notation crochet
// "parent[child]" pour que les clés correspondent au fieldMapping configuré.
// (Le support du format Tally { data: { fields: [] } } a été retiré le
// 2026-08-06 avec les sources Tally — plus aucun formulaire ne l'utilise.)
function parsePayload(parsed: unknown): Record<string, string> {
  const flat = flattenJson(parsed);

  // ⚠️ Elementor envoie ses champs sous « fields[<clé>][value] », alors que
  // l'import par API les lit à plat (« <clé> »). Sans cette normalisation, le
  // MÊME formulaire aurait besoin de DEUX mappings : celui configuré ne
  // matcherait rien côté webhook et les soumissions seraient ignorées en
  // silence. On ramène donc les deux chemins à la même forme.
  for (const [key, value] of Object.entries(flat)) {
    const m = /^fields\[([^\]]+)\]\[value\]$/.exec(key);
    if (m && flat[m[1]] === undefined) flat[m[1]] = value;
  }
  return flat;
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
