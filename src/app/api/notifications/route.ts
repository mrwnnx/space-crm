import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries";

export async function GET() {
  // Ne pas compter sur le seul proxy : un changement de son matcher exposerait ces données.
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }
  const [notifs, unreadCount] = await Promise.all([
    // La cloche n'en affiche que 20 : les lire toutes à chaque passage (15 s) grossissait sans fin.
    getNotifications(undefined, 20),
    getUnreadNotificationCount(),
  ]);

  return NextResponse.json({
    notifications: notifs.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
