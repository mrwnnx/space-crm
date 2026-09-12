import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailTemplates, contacts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { renderEmailTemplate } from "@/lib/messaging/markdown";
import { sendEmail, renderTemplate } from "@/lib/messaging/email";
import { getEmailBranding } from "@/lib/queries";

/**
 * Test 9 — jetable. La version francaise du modele brochure, rendue par le
 * vrai pipeline (branding + pied de desabonnement + en-tetes List-Unsubscribe),
 * envoyee sur la boite de Marwen pour voir dans quel onglet Gmail elle tombe.
 *
 * Depuis la machine locale, api.resend.com ne repond plus (TLS qui pend) : cet
 * essai doit partir de la prod. A retirer aussitot la reponse connue.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const to = "themarwen.tn@gmail.com";
  try {
    const [tpl] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.name, "Brochure — programme + vidéo (français)"));
    if (!tpl) return NextResponse.json({ envoye: false, raison: "modele introuvable" });

    const VARS = {
      firstName: "Marwen",
      lastName: "",
      fullName: "Marwen",
      email: to,
      formation: "UX/UI Bootcamp - september 2026",
      dateDebut: "28 septembre 2026",
      offre: "",
    };
    const branding = (await getEmailBranding()) ?? undefined;
    const [c] = await db
      .select({ t: contacts.unsubscribeToken })
      .from(contacts)
      .where(sql`lower(${contacts.email}) = ${to}`)
      .limit(1);
    const unsub = `https://space-crm-psi.vercel.app/unsubscribe/${c?.t ?? "x"}`;
    const footer = `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#9ca3af">Vous recevez cet email parce que vous avez demandé des informations sur une formation Space Academy.<br><a href="${unsub}" style="color:#9ca3af;text-decoration:underline">Se désabonner</a></p>`;
    const html = renderEmailTemplate(tpl.content, VARS, branding, undefined, footer);
    const subject = renderTemplate(tpl.subject ?? "", VARS);

    // Garde-fou : ce test ne vaut que s'il porte vraiment la video, le code
    // promo et les trois liens. Sinon on n'envoie rien.
    const ok =
      html.includes("youtu.be/94yEQ6QP55g") &&
      /20\s*%/.test(html) &&
      html.includes("wa.me/21625726708") &&
      html.includes("thespace.academy/brochure");
    if (!ok) return NextResponse.json({ envoye: false, raison: "contenu incomplet, test annule" });

    const res = await sendEmail({
      to,
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    return NextResponse.json({
      envoye: res.ok,
      id: res.id ?? null,
      erreur: res.error ?? null,
      sujet: subject,
      heure: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { envoye: false, exception: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
