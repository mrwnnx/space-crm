import "server-only";
import { Resend } from "resend";

import { asEmailDocument } from "./markdown";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Resend non configuré (RESEND_API_KEY manquant)" };
  }

  // L'expéditeur réglé dans « Design des emails » prime sur la variable
  // d'environnement. Vide = on retombe sur EMAIL_FROM : changer l'écran ne peut
  // donc pas casser les envois par omission.
  const from = await resolveSender();

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      // Enveloppe posée ICI, au seul point de sortie réel : sans balise
      // viewport, tous les clients mobiles dézooment et le texte arrive
      // minuscule. Idempotente — un HTML déjà complet ressort intact.
      html: asEmailDocument(html),
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur d'envoi email",
    };
  }
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? "");
}

/**
 * Expéditeur effectif : base d'abord, variable d'environnement ensuite.
 *
 * L'adresse en base est déjà validée à l'enregistrement (domaine vérifié chez
 * Resend). Si la lecture échoue — base indisponible — on ne bloque pas l'envoi :
 * on retombe sur EMAIL_FROM.
 */
async function resolveSender(): Promise<string> {
  const fallback = process.env.EMAIL_FROM || "CRM <noreply@example.com>";
  try {
    const { getEmailBranding } = await import("@/lib/queries");
    const b = await getEmailBranding();
    if (!b?.senderEmail) return fallback;
    return b.senderName ? `${b.senderName} <${b.senderEmail}>` : b.senderEmail;
  } catch {
    return fallback;
  }
}
