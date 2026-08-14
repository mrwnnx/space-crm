import { getCampaigns } from "@/lib/campaigns/queries";
import { PageHeader } from "@/components/page-header";
import { CampaignsList } from "@/components/campaigns/campaigns-list";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <>
      <PageHeader
        title="Campagnes"
        subtitle={`${campaigns.length} campagne${campaigns.length > 1 ? "s" : ""}`}
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl">
          <CampaignsList campaigns={campaigns} />
        </div>
      </div>
    </>
  );
}
