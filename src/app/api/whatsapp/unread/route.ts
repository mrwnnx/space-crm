import { NextResponse } from "next/server";
import { getWhatsAppUnreadCount } from "@/lib/whatsapp-inbox";

// La pastille du menu (combien de conversations attendent une lecture) et le
// dernier message reçu, que le notificateur compare pour sonner.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getWhatsAppUnreadCount());
}
