import { getBootcamps } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { BootcampCard } from "@/components/bootcamps/bootcamp-card";
import { NewBootcampButton } from "@/components/bootcamps/new-bootcamp-button";

export const dynamic = "force-dynamic";

export default async function BootcampsPage() {
  const bootcamps = await getBootcamps();

  return (
    <>
      <PageHeader
        title="Formations"
        subtitle={`${bootcamps.length} formation${bootcamps.length > 1 ? "s" : ""}`}
        actions={<NewBootcampButton />}
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
              <BootcampCard key={b.id} {...b} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
