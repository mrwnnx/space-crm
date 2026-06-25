import { getDeals, getDealsKanban } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { DealsList } from "@/components/deals/deals-list";
import { DealsKanban } from "@/components/deals/deals-kanban";
import { ViewToggle } from "@/components/view-toggle";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const isKanban = view === "kanban";

  if (isKanban) {
    const kanbanData = await getDealsKanban();
    const count = kanbanData.reduce((sum, s) => sum + s.deals.length, 0);

    return (
      <>
        <PageHeader
          title="Deals"
          subtitle={`${count} deal${count > 1 ? "s" : ""}`}
          actions={<ViewToggle current="kanban" />}
        />
        <div className="flex-1 overflow-hidden">
          <DealsKanban statuses={kanbanData} />
        </div>
      </>
    );
  }

  const dealsData = await getDeals();

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={`${dealsData.length} deal${dealsData.length > 1 ? "s" : ""}`}
        actions={<ViewToggle current="list" />}
      />
      <div className="flex-1 overflow-hidden">
        <DealsList deals={dealsData} />
      </div>
    </>
  );
}
