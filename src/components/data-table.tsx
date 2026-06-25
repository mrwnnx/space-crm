import Link from "next/link";
import { cn, initials, formatRelative } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right";
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyTitle = "Aucun élément",
  emptySubtitle = "Créez votre premier élément pour commencer.",
  getHref,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyTitle?: string;
  emptySubtitle?: string;
  getHref: (row: T) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
        <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-3 py-2.5 text-xs font-medium text-muted-foreground",
                  col.align === "right" ? "text-right" : "text-left",
                  col.className
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group border-b border-border transition-colors hover:bg-muted/40"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-3 py-2.5",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  <Link
                    href={getHref(row)}
                    className="block"
                  >
                    {col.render
                      ? col.render(row)
                      : (row as Record<string, unknown>)[col.key] as React.ReactNode || "—"}
                  </Link>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AvatarCell({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {initials(name)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary">
          {name}
        </p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export function TextCell({
  value,
  muted = true,
}: {
  value: string | null | undefined;
  muted?: boolean;
}) {
  return (
    <span className={cn("text-sm", muted ? "text-muted-foreground" : "text-foreground")}>
      {value || "—"}
    </span>
  );
}

export function DateCell({ value }: { value: Date | string | null }) {
  return (
    <span className="text-xs text-muted-foreground">{formatRelative(value)}</span>
  );
}
