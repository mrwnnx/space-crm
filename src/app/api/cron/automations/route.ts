import { NextRequest, NextResponse } from "next/server";
import { processDueAutomations } from "@/lib/automations";

// Vide la file des automatisations différées.
//
// ⚠️ Plan Hobby = 1 cron Vercel/jour : la vraie fréquence vient du workflow
// GitHub Actions (~15 min), qui appelle cette même URL. La précision d'un délai
// est donc au quart d'heure, pas à la minute.
//
// ⚠️ Vercel Cron envoie TOUJOURS du GET : ce handler DOIT exporter GET.
//
// ⚠️ Cet endpoint est HORS du proxy d'authentification (cf. src/proxy.ts) et
// porte sa propre auth par CRON_SECRET.

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

  const report = await processDueAutomations();
  return NextResponse.json({ ok: true, ...report });
}
