import "server-only";
import twilio from "twilio";

export async function sendSMS({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ ok: boolean; error?: string; sid?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from) {
    return { ok: false, error: "Twilio SMS non configuré" };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from,
      to,
      body,
    });

    return { ok: true, sid: message.sid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur SMS",
    };
  }
}
