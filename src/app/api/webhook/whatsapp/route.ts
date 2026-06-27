import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import twilio from "twilio";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
      const signature = request.headers.get("X-Twilio-Signature") || "";
      const params: Record<string, string> = {};
      for (const [key, val] of formData) {
        params[key] = String(val);
      }
      const isValid = twilio.validateRequest(
        authToken,
        signature,
        request.url,
        params
      );
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }
    const from = String(formData.get("From") || "");
    const to = String(formData.get("To") || "");
    const body = String(formData.get("Body") || "");
    const messageSid = String(formData.get("MessageSid") || "");
    const profileName = String(formData.get("ProfileName") || "");

    if (!from || !body) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Extract phone number from "whatsapp:+1234567890" format
    const fromNumber = from.replace("whatsapp:", "").replace("+", "");
    const toNumber = to.replace("whatsapp:", "").replace("+", "");

    // Find matching lead by mobile/whatsapp number (partial match on last 8 digits)
    const last8 = fromNumber.slice(-8);
    const matchingLeads = await db.query.leads.findMany({
      where: ilike(leads.mobileNo, `%${last8}%`),
      limit: 1,
    });

    const lead = matchingLeads[0];

    if (lead) {
      // Create inbound activity on the lead
      await db.insert(activities).values({
        referenceType: "lead",
        referenceId: lead.id,
        type: "whatsapp",
        direction: "inbound",
        subject: `WhatsApp reçu${profileName ? ` de ${profileName}` : ""}`,
        content: body,
      });

      // Update lastContactedAt
      await db
        .update(leads)
        .set({ lastContactedAt: new Date(), updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
    }

    return NextResponse.json({
      ok: true,
      leadFound: !!lead,
      leadId: lead?.id,
      messageSid,
    });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "WhatsApp Webhook",
    description: "Configure in Twilio Console → WhatsApp → Webhook URL",
    url: "https://your-domain.com/api/webhook/whatsapp",
  });
}
