import { getTagsWithUsage } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { TagsManager } from "@/components/tags/tags-manager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await getTagsWithUsage();

  return (
    <>
      <PageHeader
        title="Tags"
        subtitle={`${tags.length} tag${tags.length > 1 ? "s" : ""}`}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-xs text-muted-foreground">
            Étiquettes libres posées sur les leads. Elles s&apos;appliquent à la main
            depuis une fiche, ou automatiquement à tout lead venant d&apos;un
            formulaire lié à une formation.
          </p>
          <TagsManager tags={tags} />
        </div>
      </div>
    </>
  );
}
