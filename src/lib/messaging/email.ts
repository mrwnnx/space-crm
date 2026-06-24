import "server-only";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — message not sent");
    return { ok: false, error: "Email provider not configured" };
  }

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Space Academy <noreply@spaceacademy.com>",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[email] Send failed:", error);
    return { ok: false, error: error.message };
  }

  return { ok: true, id: data?.id };
}
