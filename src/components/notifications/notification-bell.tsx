"use client";

import { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { BellIcon } from "@hugeicons/core-free-icons";
import { cn, formatRelative } from "@/lib/utils";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/actions";

type Notif = {
  id: string;
  type: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<string, string> = {
  lead_assigned: "👤",
  lead_status_change: "↻",
  deal_status_change: "↻",
  task_assigned: "✓",
  task_due: "⏰",
  comment: "💬",
  mention: "@",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  async function fetchNotifs() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      setNotifs(data.notifications || []);
      setUnread(data.unreadCount || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function refHref(type: string | null, id: string | null): string {
    if (!type || !id) return "#";
    const map: Record<string, string> = {
      lead: "leads",
      deal: "deals",
      contact: "contacts",
      organization: "organizations",
    };
    return `/${map[type] || type + "s"}/${id}`;
  }

  async function markAllRead() {
    setUnread(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    await markAllNotificationsReadAction();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unread > 0) {
            setTimeout(() => markAllRead(), 2000);
          }
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HugeiconsIcon icon={BellIcon} size={18} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold text-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:text-primary/80"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Chargement...
              </p>
            ) : notifs.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Aucune notification
              </p>
            ) : (
              notifs.map((n) => (
                <a
                  key={n.id}
                  href={refHref(n.referenceType, n.referenceId)}
                  className={cn(
                    "flex gap-3 border-b border-border px-4 py-2.5 transition-colors hover:bg-muted/40",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="mt-0.5 text-sm">
                    {TYPE_ICON[n.type] || "🔔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">
                      {n.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {formatRelative(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
