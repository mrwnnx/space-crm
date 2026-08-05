import Link from "next/link";
import { cn } from "@/lib/utils";

export const SETTINGS_TABS = [
  { id: "site", label: "Site" },
  { id: "tags", label: "Tags" },
  { id: "emails", label: "Emails" },
  { id: "providers", label: "Providers" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["id"];

export function SettingsTabs({ current }: { current: SettingsTab }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {SETTINGS_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.id === "site" ? "/settings" : `/settings?tab=${tab.id}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            current === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
