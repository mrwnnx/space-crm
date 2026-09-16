import { NextResponse } from "next/server";
import { getWhatsAppUnreadCount } from "@/lib/whatsapp-inbox";

// La pastille du menu : combien de conversations attendent une lecture.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ unread: await getWhatsAppUnreadCount() });
}
