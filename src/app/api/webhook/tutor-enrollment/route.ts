import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bootcamps } from "@/db/schema";
import { sql } from "drizzle-orm";
import { importLeads } from "@/lib/import-csv";

export const maxDuration = 30;

// Inscription effective à un cours « Bootcamp UX » sur thespace.academy (hook Tutor `tutor_after_enrolled`,
// relayé par un snippet WPCode) → la personne entre dans le CRM avec le tag Spacer, selon les règles de
// l'import CSV : jamais de doublon, tag ajouté à un lead existant, cases vides complétées, rien d'écrasé.
export async function POST(request: NextRequest) {
  const secret = process.env.TUTOR_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: unknown; first_name?: unknown; last_name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "email requis" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // Un inconnu du CRM atterrit chez les anciens — formation volontairement archivée, elle ne doit pas
  // encombrer les formations actives. Si elle n'existe plus, il reste hors kanban.
  const anciens = await db.query.bootcamps.findFirst({
    where: sql`${bootcamps.name} ilike 'Anciens participants%'`,
  });

  const res = await importLeads(
    [{ email, first_name: str(body.first_name), last_name: str(body.last_name) }],
    { email: "email", first_name: "firstName", last_name: "lastName" },
    { newTagName: "Spacer", bootcampId: anciens?.id ?? null }
  );
  revalidatePath("/leads");
  return NextResponse.json(res, { status: res.errors > 0 ? 500 : 200 });
}
