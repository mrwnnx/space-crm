import "server-only";
import twilio from "twilio";

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function sendSMS({ to, body }: { to: string; body: string }) {
  const client = getTwilioClient();
  if (!client) {
    console.warn("[sms] Twilio not configured — message not sent");
    return { ok: false, error: "SMS provider not configured" };
  }

  const from = process.env.TWILIO_SMS_FROM ?? "+14155238886";
  const toNormalized = to.replace(/\s/g, "");

  try {
    const message = await client.messages.create({
      body,
      from,
      to: toNormalized,
    });
    return { ok: true, id: message.sid };
  } catch (err) {
    console.error("[sms] Send failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
