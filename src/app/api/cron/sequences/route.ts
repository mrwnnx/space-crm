import { NextRequest, NextResponse } from "next/server";
import { processSequences } from "@/lib/sequences";

// Fait avancer les séquences email : évalue les sorties, les conditions et la
// fenêtre d'envoi, puis envoie les étapes dues.
//
// ⚠️ Hors du proxy, auth par CRON_SECRET. Vercel Cron envoie toujours du GET.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET absent" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await processSequences();
  return NextResponse.json({ ok: true, ...report });
}
