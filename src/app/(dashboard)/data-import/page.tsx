import { PageHeader } from "@/components/page-header";
import { DataImporter } from "@/components/data-import/data-importer";

export const dynamic = "force-dynamic";

export default function DataImportPage() {
  return (
    <>
      <PageHeader
        title="Data Import"
        subtitle="Importez vos leads et contacts en CSV"
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <DataImporter />
        </div>
      </div>
    </>
  );
}
