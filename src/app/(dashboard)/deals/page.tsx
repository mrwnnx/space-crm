import { getDeals, getDealsKanban } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { DealsList } from "@/components/deals/deals-list";
import { DealsKanban } from "@/components/deals/deals-kanban";
import { ViewToggle } from "@/components/view-toggle";
import { SearchBar } from "@/components/search-bar";

export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { view, q } = await searchParams;
  const isKanban = view === "kanban";

  if (isKanban) {
    const kanbanData = await getDealsKanban();
    const count = kanbanData.reduce((sum, s) => sum + s.deals.length, 0);

    return (
      <>
        <PageHeader
          title="Deals"
          subtitle={`${count} deal${count > 1 ? "s" : ""}`}
          actions={
            <div className="flex items-center gap-2">
              <SearchBar />
              <ViewToggle current="kanban" />
            </div>
          }
        />
        <div className="flex-1 overflow-hidden">
          <DealsKanban statuses={kanbanData} />
        </div>
      </>
    );
  }

  const dealsData = await getDeals(q);

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={`${dealsData.length} deal${dealsData.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <SearchBar />
            <ViewToggle current="list" />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <DealsList deals={dealsData} />
      </div>
    </>
  );
}
