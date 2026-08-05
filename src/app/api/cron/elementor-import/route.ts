import { NextRequest, NextResponse } from "next/server";
import { getWpConnection, getActiveElementorSources } from "@/lib/queries";
import { importElementorSource, type ImportReport } from "@/lib/elementor-import";

// Import automatique des soumissions Elementor → leads.
//
// ⚠️ Vercel Cron envoie TOUJOURS du GET : ce handler DOIT exporter GET
// (un POST donnerait un 405 silencieux à chaque déclenchement).
//
// Auth : header `Authorization: Bearer <CRON_SECRET>` (Vercel l'ajoute
// automatiquement pour ses crons). Sans secret configuré, on refuse.

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

  const conn = await getWpConnection();
  if (!conn) {
    return NextResponse.json({ ok: false, reason: "Connexion WordPress non configurée" });
  }

  const sources = await getActiveElementorSources();
  const creds = {
    siteUrl: conn.siteUrl,
    username: conn.username,
    appPassword: conn.appPassword,
  };

  const reports: ImportReport[] = [];
  for (const source of sources) {
    // Séquentiel volontairement : le pool DB est dimensionné sur la concurrence
    // par requête HTTP, et l'API WordPress n'aime pas les rafales.
    reports.push(await importElementorSource(source, creds));
  }

  const totals = reports.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      skipped: acc.skipped + r.skipped,
    }),
    { fetched: 0, created: 0, updated: 0, skipped: 0 }
  );

  return NextResponse.json({ ok: true, sources: sources.length, totals, reports });
}
