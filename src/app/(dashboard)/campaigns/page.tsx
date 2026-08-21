import { getCampaigns, getCampaignStatusCounts } from "@/lib/campaigns/queries";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { CampaignFilters } from "@/components/campaigns/campaign-filters";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const [campaigns, counts] = await Promise.all([
    getCampaigns({ q, status }),
    getCampaignStatusCounts(),
  ]);

  const filtering = !!(q || status);

  return (
    <>
      <PageHeader
        title="Campagnes"
        subtitle={`${campaigns.length} campagne${campaigns.length > 1 ? "s" : ""}${
          filtering ? " trouvée" + (campaigns.length > 1 ? "s" : "") : ""
        }`}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="min-w-[180px] flex-1">
              <SearchBar param="q" />
            </div>
            <CampaignFilters counts={counts} />
          </div>

          <CampaignsList campaigns={campaigns} />

          {filtering && campaigns.length === 0 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Aucune campagne ne correspond. Les archivées sont masquées tant
              qu&apos;on ne les demande pas dans le filtre.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
