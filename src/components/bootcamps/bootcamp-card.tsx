import Link from "next/link";
import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon, User02Icon, ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
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
  enrolledCount: number;
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

/**
 * Jours entre aujourd'hui (à Tunis) et la date de début. On compare deux dates
 * « AAAA-MM-JJ » : la page se rend sur Vercel en UTC, sans ça le compte
 * sauterait d'un jour entre minuit et 1 h du matin.
 */
function daysUntil(startDate: string): number {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Tunis" });
  return Math.round((Date.parse(startDate) - Date.parse(today)) / 86_400_000);
}

/** « dans 31 jours », « demain », « aujourd'hui » — rien une fois la formation commencée. */
function startsIn(startDate: string | null): string | null {
  if (!startDate) return null;
  const d = daysUntil(startDate);
  if (d < 0) return null;
  if (d === 0) return "commence aujourd'hui";
  if (d === 1) return "commence demain";
  return `commence dans ${d} jours`;
}

function StatusBadge({ status }: { status: string }) {
  // statusColor rend un objet { dot, bg, text } : on prend ses classes une à une
  // (passé tel quel à cn(), il donnait les noms des clés et le badge restait sans couleur).
  const c = statusColor(statusColors[status] || "gray");
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium", c.bg, c.text)}>
      {statusLabels[status] || status}
    </span>
  );
}

function CardMenu(props: BootcampCardProps) {
  return (
    <BootcampCardMenu
      bootcamp={{
        id: props.id,
        name: props.name,
        slug: props.slug,
        description: props.description,
        startDate: props.startDate,
        endDate: props.endDate,
        status: props.status,
        capacity: props.capacity,
        currency: props.currency,
        priceTotal: props.priceTotal,
        monthlyCount: props.monthlyCount,
        monthlyAmount: props.monthlyAmount,
        archived: props.archivedAt !== null,
      }}
      canDelete={!props.isDefault}
    />
  );
}

function Dates({ startDate, endDate }: { startDate: string | null; endDate: string | null }) {
  if (!startDate) return null;
  return (
    <span>
      {formatDate(startDate)}
      {endDate && ` → ${formatDate(endDate)}`}
    </span>
  );
}

export function BootcampCard(props: BootcampCardProps) {
  const { id, name, description, startDate, endDate, status, capacity, leadCount, enrolledCount, archivedAt } = props;
  const archived = archivedAt !== null;
  const countdown = archived || status === "completed" || status === "cancelled" ? null : startsIn(startDate);

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
        <CardMenu {...props} />
      </div>

      <Link href={`/bootcamps/${id}`} className="flex flex-1 flex-col p-4">
      {/* Header — pr-16 réserve la place du badge + du menu */}
      <div className="flex items-start justify-between gap-2 pr-16">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground font-heading">
            {archived && (
              <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
        <StatusBadge status={status} />
      </div>

      {/* Dates */}
      {startDate && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Calendar03Icon} size={13} />
          <Dates startDate={startDate} endDate={endDate} />
          {countdown && <span className="text-foreground/70">· {countdown}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={User02Icon} size={13} />
            {leadCount} lead{leadCount > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} />
            {enrolledCount} inscrit{enrolledCount > 1 ? "s" : ""}
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

/**
 * La formation qui reçoit aujourd'hui les inscriptions du site, en tête de page :
 * c'est elle qu'on ouvre dix fois par jour, ses chiffres doivent se lire sans clic.
 */
export function FeaturedBootcampCard(props: BootcampCardProps) {
  const { id, name, description, startDate, endDate, status, capacity, leadCount, enrolledCount } = props;
  const days = startDate ? daysUntil(startDate) : null;

  return (
    <div className="group relative rounded-xl border border-primary/40 bg-primary/5 transition-colors hover:border-primary/60 hover:shadow-sm">
      <div className="absolute right-2 top-2 z-20">
        <CardMenu {...props} />
      </div>

      <Link href={`/bootcamps/${id}`} className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1 pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[12px] font-medium text-primary-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" />
              Inscriptions ouvertes
            </span>
            <StatusBadge status={status} />
          </div>
          <h2 className="mt-2 truncate text-lg font-semibold text-foreground font-heading">{name}</h2>
          {description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            C&apos;est ici qu&apos;arrivent les inscriptions des formulaires du site.
          </p>
        </div>

        {/* Les chiffres utiles d'un coup d'œil */}
        <dl className="grid shrink-0 grid-cols-3 gap-2 md:w-auto">
          <Stat label="Leads" value={String(leadCount)} />
          <Stat label="Inscrits" value={capacity ? `${enrolledCount} / ${capacity}` : String(enrolledCount)} />
          <Stat
            label={days !== null && days < 0 ? "Commencée le" : "Début"}
            value={days !== null && days > 0 ? `J-${days}` : days === 0 ? "Aujourd'hui" : startDate ? formatDate(startDate) : "—"}
            hint={days !== null && days > 0 ? <Dates startDate={startDate} endDate={endDate} /> : undefined}
          />
        </dl>

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={16}
          className="hidden shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block"
        />
      </Link>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="min-w-24 rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</dd>
      {hint && <dd className="text-[11px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
