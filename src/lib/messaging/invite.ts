import "server-only";
import { sendEmail } from "./email";

// Même résolution que les campagnes (src/lib/campaigns/send.ts) : ce module-là
// tire db + audience + template, on ne l'importe pas juste pour 5 lignes.
function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001"
  );
}

/**
 * Email d'invitation d'un collaborateur : son adresse vient d'être ajoutée à
 * l'allowlist, il crée lui-même son mot de passe depuis /login.
 */
export async function sendInviteEmail(email: string) {
  const loginUrl = `${baseUrl()}/login`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:520px">
      <p>Bonjour,</p>
      <p>Tu as été invité(e) à rejoindre <strong>Academy CRM</strong>.</p>
      <p>
        <a href="${loginUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:500">Créer mon compte</a>
      </p>
      <p>
        Sur l'écran qui s'ouvre, utilise le formulaire <strong>« Créer un compte »</strong>
        avec cette adresse (<strong>${email}</strong>) et choisis ton mot de passe.
      </p>
      <p style="color:#6b7280;font-size:12px">
        Si le bouton ne fonctionne pas, copie ce lien : ${loginUrl}
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Invitation à rejoindre Academy CRM",
    html,
  });
}
