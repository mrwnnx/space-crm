import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadActivities, pipelineStages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { recomputeLeadScore } from "@/lib/scoring-server";

export async function POST(request: NextRequest) {
  // ── Optional secret verification ───────────────────
  const secret = request.nextUrl.searchParams.get("secret");
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse payload (Elementor sends form fields) ────
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    // Elementor sometimes sends form-encoded data
    const formData = await request.formData();
    payload = Object.fromEntries(formData.entries());
  }

  // ── Flexible field mapping ─────────────────────────
  // Elementor field keys vary; we try common names.
  const get = (...keys: string[]): string | undefined => {
    for (const key of keys) {
      const val = findKey(payload, key);
      if (val) return val;
    }
    return undefined;
  };

  const fullName =
    get("full_name", "fullname", "name", "nom", "Nom", "Name") ??
    [get("first_name", "prenom", "Prénom"), get("last_name", "nom_de_famille")]
      .filter(Boolean)
      .join(" ") ??
    "Lead sans nom";

  const email = get("email", "Email", "courriel", "mail");
  const phone = get("phone", "tel", "telephone", "Phone", "Téléphone", "whatsapp");
  const whatsapp =
    get("whatsapp", "WhatsApp", "numero_whatsapp") ?? phone;
  const source = get("source", "form_name", "form_id") ?? "Elementor";
  const message = get("message", "Message", "comment", "notes");

  if (!email && !phone) {
    return NextResponse.json(
      { error: "Missing email or phone" },
      { status: 400 }
    );
  }

  // ── Dedup: skip if email already exists ────────────
  if (email) {
    const existing = await db.query.leads.findFirst({
      where: eq(leads.email, email),
    });
    if (existing) {
      // Log a new webhook activity on the existing lead
      await db.insert(leadActivities).values({
        leadId: existing.id,
        type: "webhook_in",
        direction: "inbound",
        subject: `Nouvelle soumission de formulaire (${source})`,
        content: message ?? undefined,
      });
      await recomputeLeadScore(existing.id);
      return NextResponse.json({
        ok: true,
        message: "Lead already exists, activity logged",
        leadId: existing.id,
      });
    }
  }

  // ── Get default stage ("Nouveau") ──────────────────
  const nouveauStage = await db.query.pipelineStages.findFirst({
    where: eq(pipelineStages.slug, "nouveau"),
  });

  // ── Create lead ────────────────────────────────────
  const [lead] = await db
    .insert(leads)
    .values({
      fullName,
      email,
      phone,
      whatsapp,
      source,
      stageId: nouveauStage?.id,
      notes: message,
    })
    .returning();

  // ── Log webhook activity ───────────────────────────
  await db.insert(leadActivities).values({
    leadId: lead.id,
    type: "webhook_in",
    direction: "inbound",
    subject: `Lead reçu via ${source}`,
    content: message ?? undefined,
  });

  await recomputeLeadScore(lead.id);

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
}

// ── Case-insensitive key lookup ────────────────────────
function findKey(
  obj: Record<string, unknown>,
  target: string
): string | undefined {
  const lowerTarget = target.toLowerCase();
  for (const [key, value] of Object.entries(obj)) {
    if (key.toLowerCase() === lowerTarget && typeof value === "string") {
      return value.trim();
    }
  }
  return undefined;
}
