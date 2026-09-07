"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** « Toutes » ou seulement celles qui me sont assignées. Même forme que
 *  ViewToggle, et il conserve le paramètre `view` en changeant de vue. */
export function TasksScopeToggle({ mine }: { mine: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(onlyMine: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (onlyMine) params.set("mine", "1");
    else params.delete("mine");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {[
        { onlyMine: false, label: "Toutes" },
        { onlyMine: true, label: "Mes tâches" },
      ].map((v) => (
        <Link
          key={v.label}
          href={hrefFor(v.onlyMine)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mine === v.onlyMine
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
