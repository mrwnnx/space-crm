import { getBootcamps, DEFAULT_BOOTCAMP_ID, type BootcampWithLeadCount } from "@/lib/queries";
import { formationActive } from "@/lib/whatsapp-flow";
import { PageHeader } from "@/components/page-header";
import { BootcampCard, FeaturedBootcampCard } from "@/components/bootcamps/bootcamp-card";
import { NewBootcampButton } from "@/components/bootcamps/new-bootcamp-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Date de début la plus récente d'abord, sans date à la fin (même ordre que formationActive). */
function parDebut(a: BootcampWithLeadCount, b: BootcampWithLeadCount) {
  if (a.startDate === b.startDate) return 0;
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;
  return a.startDate < b.startDate ? 1 : -1;
}

export default async function BootcampsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  // Les archivées sont masquées par défaut : on les charge seulement si demandé.
  // La formation ouverte vient de la même requête que le WhatsApp (formulaires
  // actifs) : la page et les envois ne peuvent pas désigner deux formations différentes.
  const [bootcamps, active] = await Promise.all([
    getBootcamps({ includeArchived: showArchived }),
    formationActive(),
  ]);

  const featured = active ? bootcamps.find((b) => b.id === active.id) : undefined;
  const rest = bootcamps.filter((b) => b !== featured).sort(parDebut);
  const groups = [
    {
      title: "À venir et en cours",
      items: rest.filter((b) => !b.archivedAt && b.status !== "completed" && b.status !== "cancelled"),
    },
    {
      title: "Terminées",
      items: rest.filter((b) => !b.archivedAt && (b.status === "completed" || b.status === "cancelled")),
    },
    { title: "Archivées", items: rest.filter((b) => b.archivedAt) },
  ].filter((g) => g.items.length > 0);

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
          <div className="space-y-6">
            {featured ? (
              <FeaturedBootcampCard {...featured} isDefault={featured.id === DEFAULT_BOOTCAMP_ID} />
            ) : (
              // Sans formulaire actif, les inscriptions du site n'arrivent nulle part : autant le dire.
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
                Aucune formation ne reçoit les inscriptions du site en ce moment (aucun formulaire actif).
              </p>
            )}

            {groups.map((g) => (
              <section key={g.title}>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {g.title} <span className="text-muted-foreground/60">· {g.items.length}</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((b) => (
                    <BootcampCard key={b.id} {...b} isDefault={b.id === DEFAULT_BOOTCAMP_ID} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
