import "server-only";
import twilio from "twilio";

export async function sendWhatsApp({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio WhatsApp non configuré" };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from,
      to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
      body,
    });

    return { ok: true, sid: message.sid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur WhatsApp",
    };
  }
}
