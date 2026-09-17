import { PageHeader } from "@/components/page-header";
import { DataImporter } from "@/components/data-import/data-importer";
import { getBootcamps, getTags } from "@/lib/queries";

export const dynamic = "force-dynamic";
// L'import se fait par paquets : chaque appel serveur doit tenir dans cette fenêtre.
export const maxDuration = 60;

export default async function DataImportPage() {
  const [tags, bootcamps] = await Promise.all([getTags(), getBootcamps()]);

  return (
    <>
      <PageHeader
        title="Data Import"
        subtitle="Importez vos leads et contacts en CSV"
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <DataImporter
            tags={tags.map((t) => ({ id: t.id, name: t.name }))}
            bootcamps={bootcamps.map((b) => ({ id: b.id, name: b.name }))}
          />
        </div>
      </div>
    </>
  );
}
