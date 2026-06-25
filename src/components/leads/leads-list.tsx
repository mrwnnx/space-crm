import Link from "next/link";
import { cn, statusColor, initials, formatRelative } from "@/lib/utils";
import type { LeadWithRelations } from "@/lib/queries";

export function LeadsList({ leads }: { leads: LeadWithRelations[] }) {
  if (leads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
        <p className="text-sm font-medium text-foreground">Aucun lead</p>
        <p className="text-xs text-muted-foreground">
          Créez votre premier lead pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            <Th className="pl-5">Name</Th>
            <Th>Status</Th>
            <Th>Email</Th>
            <Th>Phone</Th>
            <Th>Source</Th>
            <Th>Organization</Th>
            <Th className="pr-5 text-right">Created</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const sc = lead.status ? statusColor(lead.status.color) : null;
            return (
              <tr
                key={lead.id}
                className="group border-b border-border transition-colors hover:bg-muted/40"
              >
                <td className="py-2.5 pl-5">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(lead.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary">
                        {lead.fullName}
                      </p>
                      {lead.jobTitle && (
                        <p className="text-xs text-muted-foreground">
                          {lead.jobTitle}
                        </p>
                      )}
                    </div>
                  </Link>
                </td>
                <td>
                  {sc && lead.status && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        sc.bg,
                        sc.text
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", sc.dot)} />
                      {lead.status.name}
                    </span>
                  )}
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {lead.email || "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {lead.mobileNo || lead.phone || "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {lead.source?.name || "—"}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-muted-foreground">
                    {lead.organizationName || lead.organization?.name || "—"}
                  </span>
                </td>
                <td className="pr-5 text-right">
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(lead.createdAt)}
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

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}
