import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, User02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn, formatDate, statusColor } from "@/lib/utils";

type BootcampCardProps = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "draft" | "open" | "in_progress" | "completed" | "cancelled";
  capacity: number | null;
  leadCount: number;
};

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  open: "Ouvert",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé",
};

const statusColors: Record<string, string> = {
  draft: "gray",
  open: "blue",
  in_progress: "green",
  completed: "purple",
  cancelled: "red",
};

export function BootcampCard({
  id,
  name,
  description,
  startDate,
  endDate,
  status,
  capacity,
  leadCount,
}: BootcampCardProps) {
  return (
    <Link
      href={`/bootcamps/${id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30 hover:shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground font-heading">
            {name}
          </h3>
          {description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            statusColor(statusColors[status] || "gray")
          )}
        >
          {statusLabels[status] || status}
        </span>
      </div>

      {/* Dates */}
      {startDate && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Calendar03Icon} size={13} />
          <span>
            {formatDate(startDate)}
            {endDate && ` → ${formatDate(endDate)}`}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={User02Icon} size={13} />
          <span>
            {leadCount} lead{leadCount > 1 ? "s" : ""}
            {capacity && ` / ${capacity}`}
          </span>
        </div>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={14}
          className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
    </Link>
  );
}
