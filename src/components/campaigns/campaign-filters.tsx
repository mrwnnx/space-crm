"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { STATUS_LABEL } from "./status-labels";

/** Ordre d'affichage : le cycle de vie d'une campagne, pas l'ordre alphabétique. */
const ORDER = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "sent",
  "failed",
  "cancelled",
  "archived",
];

export function CampaignFilters({ counts }: { counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("status") ?? "";

  function setStatus(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("status", value);
    else next.delete("status");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <select
      value={current}
      onChange={(e) => setStatus(e.target.value)}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
    >
      <option value="">Tous les statuts</option>
      {ORDER.filter((s) => counts[s]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]?.text ?? s} ({counts[s]})
        </option>
      ))}
    </select>
  );
}
