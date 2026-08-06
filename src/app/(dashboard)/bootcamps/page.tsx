import { getBootcamps, DEFAULT_BOOTCAMP_ID } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { BootcampCard } from "@/components/bootcamps/bootcamp-card";
import { NewBootcampButton } from "@/components/bootcamps/new-bootcamp-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BootcampsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  // Les archivées sont masquées par défaut : on les charge seulement si demandé.
  const bootcamps = await getBootcamps({ includeArchived: showArchived });

  return (
    <>
      <PageHeader
        title="Formations"
        subtitle={`${bootcamps.length} formation${bootcamps.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={showArchived ? "/bootcamps" : "/bootcamps?archived=1"}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showArchived ? "Masquer les archivées" : "Voir les archivées"}
            </Link>
            <NewBootcampButton />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {bootcamps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-muted-foreground">
              Aucune formation pour le moment.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Créez votre première formation pour organiser vos leads.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {bootcamps.map((b) => (
              <BootcampCard key={b.id} {...b} isDefault={b.id === DEFAULT_BOOTCAMP_ID} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
