"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function LeadsViewToggle({ current }: { current: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") params.delete("view");
    else params.set("view", view);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const views = [
    { id: "list", label: "List" },
    { id: "kanban", label: "Kanban" },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {views.map((v) => (
        <Link
          key={v.id}
          href={hrefFor(v.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            current === v.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
