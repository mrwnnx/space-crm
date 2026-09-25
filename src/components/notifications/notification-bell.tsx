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

/**
 * Le tiroir-caisse : deux clochettes brillantes très courtes (« ka »), puis
 * une tenue aiguë qui s'éteint (« ching »). Synthétisé, pas de fichier à
 * charger ; muet tant que la page n'a pas reçu un clic (règle du navigateur).
 */
function kaching() {
  try {
    const ctx = new AudioContext();
    const t0 = ctx.currentTime;
    const note = (freq: number, at: number, duree: number, gain: number, type: OscillatorType = "triangle") => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + duree);
      o.connect(g).connect(ctx.destination);
      o.start(at);
      o.stop(at + duree + 0.05);
    };
    note(1318, t0, 0.12, 0.25); // « ka »
    note(1760, t0 + 0.09, 0.12, 0.25);
    note(2637, t0 + 0.2, 0.9, 0.3, "sine"); // « ching », longue
    note(3951, t0 + 0.2, 0.6, 0.12, "sine"); // son harmonique, l'éclat
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // pas de son possible : la notification reste
  }
}

const TYPE_ICON: Record<string, string> = {
  lead_assigned: "👤",
  lead_enrolled: "💰",
  assistant_escalade: "✨",
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
  // La dernière inscription vue : une plus récente = le tiroir-caisse sonne.
  // `undefined` = premier passage, on mémorise sans sonner.
  const derniereInscription = useRef<string | null | undefined>(undefined);

  async function fetchNotifs() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      const liste: Notif[] = data.notifications || [];
      setNotifs(liste);
      setUnread(data.unreadCount || 0);
      const inscription = liste.find((n) => n.type === "lead_enrolled")?.id ?? null;
      if (derniereInscription.current !== undefined && inscription && inscription !== derniereInscription.current) {
        kaching();
      }
      derniereInscription.current = inscription;
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // 15 s : le tiroir-caisse ne doit pas traîner
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
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[12px] font-bold text-white">
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
                className="text-[12px] text-primary hover:text-primary/80"
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
                  href={
                    // L'assistant a passé la main : on va droit à la conversation, où sa proposition attend.
                    n.type === "assistant_escalade" && n.referenceId
                      ? `/whatsapp?lead=${n.referenceId}`
                      : refHref(n.referenceType, n.referenceId)
                  }
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
                    <p className="mt-0.5 text-[12px] text-muted-foreground/70">
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
