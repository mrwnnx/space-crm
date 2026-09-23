import { NextResponse } from "next/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries";

export async function GET() {
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
