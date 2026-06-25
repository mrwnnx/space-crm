import { NextResponse } from "next/server";
import { getNotifications, getUnreadNotificationCount } from "@/lib/queries";

export async function GET() {
  const [notifs, unreadCount] = await Promise.all([
    getNotifications(),
    getUnreadNotificationCount(),
  ]);

  return NextResponse.json({
    notifications: notifs.slice(0, 20).map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
