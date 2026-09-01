import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { campaignLinkClicks, campaignRecipients, contacts } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

/**
 * Webhook Resend : apprend au CRM ce qui n'a PAS été délivré.
 *
 * Sans lui, le CRM enregistre ce que Resend *accepte* et ignore ce qui
 * rebondit quelques secondes plus tard — un destinataire resterait "envoyé"
 * alors que l'adresse n'existe pas.
 */

/**
 * Vérifie la signature Svix (protocole utilisé par Resend).
 *
 * Indispensable : sans elle, quiconque connaît l'URL pourrait marquer
 * n'importe quelle adresse comme invalide et la faire disparaître des
 * campagnes.
 */
function verifySignature(
  secret: string,
  headers: { id: string; timestamp: string; signature: string },
  body: string
): boolean {
  // whsec_<base64> — la partie utile est après le préfixe.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${headers.id}.${headers.timestamp}.${body}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");

  // L'en-tête peut porter plusieurs signatures ("v1,xxx v1,yyy") pendant une
  // rotation de secret : il suffit qu'une seule corresponde.
  for (const part of headers.signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Rebond DUR : l'adresse n'existe pas. À distinguer d'une boîte pleine. */
function isHardBounce(data: Record<string, unknown>): boolean {
  const bounce = (data.bounce ?? {}) as Record<string, unknown>;
  const type = String(bounce.type ?? "").toLowerCase();
  const subType = String(bounce.subType ?? "").toLowerCase();
  return type === "permanent" || subType === "general" || subType === "nosuchuser";
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    // Refus franc plutôt qu'acceptation silencieuse : un webhook non vérifié
    // est une porte ouverte, pas une commodité.
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }

  const raw = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Signature absente" }, { status: 401 });
  }
  if (!verifySignature(secret, { id, timestamp, signature }, raw)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let payload: { type?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const type = payload.type ?? "";
  const data = payload.data ?? {};
  const emailId = String(data.email_id ?? "");
  const to = Array.isArray(data.to) ? String(data.to[0] ?? "") : String(data.to ?? "");

  // ── Suivi d'engagement : n'altère PAS le statut d'envoi.
  //    Une ouverture ou un clic s'ajoute à un email déjà "sent" ; les écraser
  //    ferait disparaître l'information d'envoi.
  if (type === "email.delivered" && emailId) {
    await db
      .update(campaignRecipients)
      .set({ deliveredAt: new Date() })
      .where(eq(campaignRecipients.resendId, emailId));
    return NextResponse.json({ ok: true, type });
  }

  if ((type === "email.opened" || type === "email.clicked") && emailId) {
    const isOpen = type === "email.opened";

    // L'URL cliquée n'est portée QUE par cet événement : si on ne la garde
    // pas ici, on saura qu'il y a eu un clic mais jamais sur quoi.
    if (!isOpen) {
      const link = String(
        ((data.click ?? {}) as Record<string, unknown>).link ?? ""
      ).trim();
      if (link) {
        const [rec] = await db
          .select({ id: campaignRecipients.id, campaignId: campaignRecipients.campaignId })
          .from(campaignRecipients)
          .where(eq(campaignRecipients.resendId, emailId))
          .limit(1);
        if (rec) {
          await db.insert(campaignLinkClicks).values({
            campaignId: rec.campaignId,
            recipientId: rec.id,
            url: link,
          });
        }
      }
    }

    await db
      .update(campaignRecipients)
      .set(
        isOpen
          ? {
              // COALESCE : on garde la PREMIÈRE ouverture, pas la dernière.
              openedAt: sql`coalesce(${campaignRecipients.openedAt}, now())`,
              openCount: sql`${campaignRecipients.openCount} + 1`,
            }
          : {
              clickedAt: sql`coalesce(${campaignRecipients.clickedAt}, now())`,
              clickCount: sql`${campaignRecipients.clickCount} + 1`,
            }
      )
      .where(eq(campaignRecipients.resendId, emailId));
    return NextResponse.json({ ok: true, type });
  }

  // ── Incidents : ceux-là changent bien le statut.
  const STATUS: Record<string, string> = {
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
  };
  const status = STATUS[type];
  if (!status) return NextResponse.json({ ok: true, ignored: type });

  // 1. Le destinataire de la campagne concernée.
  const err =
    type === "email.bounced"
      ? String(((data.bounce ?? {}) as Record<string, unknown>).message ?? "Rebond")
      : type;

  let touched = 0;
  if (emailId) {
    const rows = await db
      .update(campaignRecipients)
      .set({ status, error: err })
      .where(eq(campaignRecipients.resendId, emailId))
      .returning({ id: campaignRecipients.id });
    touched = rows.length;
  }

  // Repli par adresse : un rebond simulé revient en moins de 2 s, parfois
  // AVANT que l'envoi ait fini d'écrire les `resend_id` de son lot. L'UPDATE
  // ci-dessus ne trouve alors rien, et l'événement serait perdu en silence.
  if (touched === 0 && to) {
    await db
      .update(campaignRecipients)
      .set({ status, error: err })
      .where(
        and(
          sql`lower(${campaignRecipients.email}) = ${to.toLowerCase()}`,
          inArray(campaignRecipients.status, ["pending", "sent"])
        )
      );
  }

  // 2. Le contact : seul un rebond DUR le retire des campagnes futures.
  //    Une plainte pour spam vaut désabonnement — la personne a dit non.
  if (to) {
    if (type === "email.bounced" && isHardBounce(data)) {
      await db
        .update(contacts)
        .set({
          bouncedAt: new Date(),
          bounceReason: String(
            ((data.bounce ?? {}) as Record<string, unknown>).message ?? "Adresse invalide"
          ),
          updatedAt: new Date(),
        })
        .where(sql`lower(${contacts.email}) = ${to.toLowerCase()}`);
    } else if (type === "email.complained") {
      await db
        .update(contacts)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(sql`lower(${contacts.email}) = ${to.toLowerCase()}`);
    }
  }

  return NextResponse.json({ ok: true, type, status });
}
