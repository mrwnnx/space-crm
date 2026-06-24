import "server-only";
import twilio from "twilio";

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export async function sendWhatsApp({
  to,
  body,
}: {
  to: string;
  body: string;
}) {
  const client = getTwilioClient();
  if (!client) {
    console.warn("[whatsapp] Twilio not configured — message not sent");
    return { ok: false, error: "WhatsApp provider not configured" };
  }

  // Normalize phone number (ensure whatsapp: prefix)
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
  const toNormalized = to.startsWith("whatsapp:")
    ? to
    : `whatsapp:${to.replace(/\s/g, "")}`;

  try {
    const message = await client.messages.create({
      body,
      from,
      to: toNormalized,
    });
    return { ok: true, id: message.sid };
  } catch (err) {
    console.error("[whatsapp] Send failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
