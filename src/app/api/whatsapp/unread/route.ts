import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getWhatsAppUnreadCount } from "@/lib/whatsapp-inbox";

// La pastille du menu (combien de conversations attendent une lecture) et le
// dernier message reçu, que le notificateur compare pour sonner.
export const dynamic = "force-dynamic";

export async function GET() {
  // Ne pas compter sur le seul proxy : un changement de son matcher exposerait ces données.
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  return NextResponse.json(await getWhatsAppUnreadCount());
}
