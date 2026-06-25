import Link from "next/link";
import { cn, initials, formatRelative, statusColor } from "@/lib/utils";
import type { DealWithRelations } from "@/lib/queries";

export function DealsList({ deals }: { deals: DealWithRelations[] }) {
  if (deals.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
        <p className="text-sm font-medium text-foreground">Aucun deal</p>
        <p className="text-xs text-muted-foreground">
          Convertissez un lead en deal pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <th className="px-3 py-2.5 pl-5 text-left text-xs font-medium text-muted-foreground">
              Organization
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Deal value
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Probability
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
              Owner
            </th>
            <th className="px-3 py-2.5 pr-5 text-right text-xs font-medium text-muted-foreground">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const sc = deal.status ? statusColor(deal.status.color) : null;
            return (
              <tr
                key={deal.id}
                className="group border-b border-border transition-colors hover:bg-muted/40"
              >
                <td className="py-2.5 pl-5">
                  <Link href={`/deals/${deal.id}`} className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {deal.organization?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary">
                        {deal.organization?.name || "Deal sans org"}
                      </p>
                      {deal.lead && (
                        <p className="text-xs text-muted-foreground">
                          from {deal.lead.fullName}
                        </p>
                      )}
                    </div>
                  </Link>
                </td>
                <td>
                  {sc && deal.status && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        sc.bg,
                        sc.text
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      {deal.status.name}
                    </span>
                  )}
                </td>
                <td>
                  <span className="text-sm font-medium text-foreground">
                    {deal.dealValue
                      ? `${Number(deal.dealValue).toLocaleString("fr-FR")} €`
                      : "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {deal.probability ? `${Number(deal.probability)}%` : "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {deal.owner || "—"}
                  </span>
                </td>
                <td className="pr-5 text-right">
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(deal.createdAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
