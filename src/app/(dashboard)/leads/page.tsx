import { getLeads, getLeadsKanban, getLeadSources, getIndustries, getLeadStatuses, getViewSettings } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { LeadsList } from "@/components/leads/leads-list";
import { LeadsKanban } from "@/components/leads/leads-kanban";
import { LeadsViewToggle } from "@/components/leads/leads-view-toggle";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { SearchBar } from "@/components/search-bar";
import { SavedViewsDropdown } from "@/components/saved-views-dropdown";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const { view, q } = await searchParams;
  const isKanban = view === "kanban";

  const [sources, industries, statuses, savedViews] = await Promise.all([
    getLeadSources(),
    getIndustries(),
    getLeadStatuses(),
    getViewSettings("leads"),
  ]);

  if (isKanban) {
    const kanbanData = await getLeadsKanban();
    const count = kanbanData.reduce((sum, s) => sum + s.leads.length, 0);

    return (
      <>
        <PageHeader
          title="Leads"
          subtitle={`${count} lead${count > 1 ? "s" : ""}`}
          actions={
            <div className="flex items-center gap-2">
              <SavedViewsDropdown
                routeName="leads"
                views={savedViews.map((v) => ({
                  id: v.id,
                  label: v.label,
                  type: v.type,
                  filters: v.filters as { q?: string } | null,
                  public: v.public,
                }))}
                currentView={isKanban ? "kanban" : "list"}
                currentSearch={q || ""}
              />
              <SearchBar />
              <LeadsViewToggle current="kanban" />
              <NewLeadButton statuses={statuses} sources={sources} industries={industries} />
            </div>
          }
        />
        <div className="flex-1 overflow-hidden">
          <LeadsKanban statuses={kanbanData} />
        </div>
      </>
    );
  }

  const leadsData = await getLeads(q);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leadsData.length} lead${leadsData.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <SavedViewsDropdown
              routeName="leads"
              views={savedViews.map((v) => ({
                id: v.id,
                label: v.label,
                type: v.type,
                filters: v.filters as { q?: string } | null,
                public: v.public,
              }))}
              currentView="list"
              currentSearch={q || ""}
            />
            <SearchBar />
            <LeadsViewToggle current="list" />
            <NewLeadButton statuses={statuses} sources={sources} industries={industries} />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <LeadsList leads={leadsData} />
      </div>
    </>
  );
}
