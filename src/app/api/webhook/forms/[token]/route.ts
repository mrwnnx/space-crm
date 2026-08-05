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
