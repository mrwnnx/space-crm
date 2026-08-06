import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, User02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn, formatDate, statusColor } from "@/lib/utils";
import { BootcampCardMenu } from "@/components/bootcamps/bootcamp-card-menu";

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
  currency: string;
  priceTotal: string | null;
  monthlyCount: number | null;
  monthlyAmount: string | null;
  /** La formation par défaut n'est pas supprimable (les leads orphelins y atterrissent). */
  isDefault: boolean;
  archivedAt: Date | null;
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

export function BootcampCard(props: BootcampCardProps) {
  const {
    id,
    name,
    description,
    startDate,
    endDate,
    status,
    capacity,
    leadCount,
    isDefault,
    archivedAt,
  } = props;
  const archived = archivedAt !== null;

  return (
    // `relative` : le menu est posé par-dessus, en FRÈRE du Link — un clic sur le
    // menu ne remonte donc pas jusqu'à la navigation.
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card transition-colors hover:border-primary/30 hover:shadow-sm",
        archived ? "border-dashed border-border opacity-60" : "border-border"
      )}
    >
      <div className="absolute right-2 top-2 z-20">
        <BootcampCardMenu
          bootcamp={{
            id,
            name,
            slug: props.slug,
            description,
            startDate,
            endDate,
            status,
            capacity,
            currency: props.currency,
            priceTotal: props.priceTotal,
            monthlyCount: props.monthlyCount,
            monthlyAmount: props.monthlyAmount,
            archived,
          }}
          canDelete={!isDefault}
        />
      </div>

      <Link href={`/bootcamps/${id}`} className="flex flex-1 flex-col p-4">
      {/* Header — pr-16 réserve la place du badge + du menu */}
      <div className="flex items-start justify-between gap-2 pr-16">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground font-heading">
            {archived && (
              <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                Archivée
              </span>
            )}
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
    </div>
  );
}
