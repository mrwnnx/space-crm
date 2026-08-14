"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  User02Icon,
  Contact01Icon,
  Note02Icon,
  Task01Icon,
  Call02Icon,
  Calendar03Icon,
  Setting06Icon,
  Search01Icon,
  Add01Icon,
  Menu02Icon,
  Cancel01Icon,
  GraduationCapIcon,
  Tag01Icon,
  Mail01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";

type NavItem = {
  href: string;
  label: string;
  icon: typeof User02Icon;
};

const primaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Analytics01Icon },
  { href: "/bootcamps", label: "Formations", icon: GraduationCapIcon },
  { href: "/leads", label: "Leads", icon: User02Icon },
  { href: "/analytics", label: "Analytics", icon: Analytics01Icon },
  { href: "/contacts", label: "Contacts", icon: Contact01Icon },
  { href: "/tags", label: "Tags", icon: Tag01Icon },
  { href: "/campaigns", label: "Campagnes", icon: Mail01Icon },
];

const secondaryNav: NavItem[] = [
  { href: "/notes", label: "Notes", icon: Note02Icon },
  { href: "/tasks", label: "Tasks", icon: Task01Icon },
  { href: "/call-logs", label: "Call Logs", icon: Call02Icon },
  { href: "/calendar", label: "Calendar", icon: Calendar03Icon },
  { href: "/data-import", label: "Data Import", icon: Add01Icon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <HugeiconsIcon icon={Menu02Icon} size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            A
          </div>
          <span className="flex-1 text-sm font-semibold text-foreground font-heading">
            Academy CRM
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close menu"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-muted-foreground">
            <HugeiconsIcon icon={Search01Icon} size={15} />
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3">
          {primaryNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}

          <div className="my-2 h-px bg-border" />

          {secondaryNav.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive("/settings") && "bg-muted text-foreground"
              )}
            >
              <HugeiconsIcon icon={Setting06Icon} size={17} />
              Settings
            </Link>
            <NotificationBell />
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-primary/10 text-primary"
      )}
    >
      <HugeiconsIcon icon={item.icon} size={17} />
      {item.label}
    </Link>
  );
}
