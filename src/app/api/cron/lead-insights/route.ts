import { NextRequest, NextResponse } from "next/server";
import { relireConversationsRetombees } from "@/lib/ai/lead-insights";

// Relecture IA des leads dont la conversation WhatsApp est retombée (dernier
// message reçu il y a plus de 30 min, et après la dernière lecture).
//
// Appelé au rythme du workflow GitHub Actions (~15 min, cf.
// .github/workflows/elementor-import.yml) : la relecture arrive donc entre 30
// et ~45 min après le dernier message.
//
// ⚠️ Vercel Cron envoie TOUJOURS du GET : ce handler DOIT exporter GET.
//
// ⚠️ Cet endpoint est HORS du proxy d'authentification (cf. src/proxy.ts) et
// porte sa propre auth par CRON_SECRET.

export const dynamic = "force-dynamic";
// 10 lectures en série à ~10 s : le budget interne (100 s) s'arrête avant.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET absent" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY absente" });
  }

  const bilan = await relireConversationsRetombees(10, 100_000);
  return NextResponse.json({ ok: true, ...bilan });
}
