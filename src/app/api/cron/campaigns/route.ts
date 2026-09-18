import { NextRequest, NextResponse } from "next/server";
import { getDueScheduledCampaigns, unscheduleCampaign } from "@/lib/campaigns/queries";
import { checkCampaign, hasBlockingError } from "@/lib/campaigns/preflight";
import { sendCampaign } from "@/lib/campaigns/send";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { eq } from "drizzle-orm";

// Envoie les campagnes programmées dont l'heure est passée.
//
// ⚠️ Plan Hobby = 1 cron Vercel/jour : la vraie fréquence vient du workflow
// GitHub Actions (~15 min), qui appelle cette URL. Une campagne programmée à
// 09:00 part donc entre 09:00 et ~09:15 — jamais avant.
//
// Le plafond quotidien s'applique comme à un envoi manuel : au-delà, la
// campagne reste « sending » avec des destinataires en attente, à reprendre
// depuis l'écran. Ce cron ne touche QUE les campagnes « scheduled » — jamais
// une « sending », pour ne pas doubler un envoi repris à la main au même moment.
//
// ⚠️ Vercel Cron envoie TOUJOURS du GET : ce handler DOIT exporter GET.
// ⚠️ Hors du proxy d'authentification (cf. src/proxy.ts) : auth par CRON_SECRET.

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

  const due = await getDueScheduledCampaigns();
  const report: { id: string; name: string; sent?: number; remaining?: number; error?: string }[] = [];

  for (const c of due) {
    // Le texte a pu être modifié après la programmation : on revérifie. Un
    // contenu bloqué repasse en brouillon plutôt que de rester « programmée »
    // à jamais sans partir.
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, c.id)).limit(1);
    const checks = checkCampaign({ subject: row?.subject ?? "", content: row?.content ?? "" });
    if (hasBlockingError(checks)) {
      await unscheduleCampaign(c.id);
      report.push({
        id: c.id,
        name: c.name,
        error: "Repassée en brouillon : " + checks.filter((k) => k.level === "error").map((k) => k.message).join(" "),
      });
      continue;
    }

    const r = await sendCampaign(c.id);
    report.push({ id: c.id, name: c.name, sent: r.sent, remaining: r.remaining, error: r.error });
  }

  return NextResponse.json({ ok: true, due: due.length, campaigns: report });
}
