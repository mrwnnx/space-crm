import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigest } from "@/lib/digest";

// Digest quotidien de la file d'appels.
//
// Appelé par le workflow GitHub toutes les ~15 min : l'endpoint décide lui-même
// s'il doit envoyer (après 7 h à Tunis, une seule fois par jour). L'idempotence
// vient d'une contrainte d'unicité en base, pas d'un horaire de cron — GitHub ne
// garantit pas la minute.
//
// ⚠️ Vercel Cron envoie TOUJOURS du GET. Hors du proxy, auth par CRON_SECRET.

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

  // ?force=1 : envoi immédiat, pour tester sans attendre 7 h.
  const force = request.nextUrl.searchParams.get("force") === "1";
  const report = await sendDailyDigest(force);
  return NextResponse.json({ ok: true, ...report });
}
