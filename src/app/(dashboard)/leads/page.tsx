import { getLeads, getLeadSources, getLeadStatuses, getBootcamps, getViewSettings, getTags } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { LeadsList } from "@/components/leads/leads-list";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { SearchBar } from "@/components/search-bar";
import { SavedViewsDropdown } from "@/components/saved-views-dropdown";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bootcamp?: string; statusId?: string; temperature?: string; converted?: string }>;
}) {
  const { q, bootcamp, statusId, temperature, converted } = await searchParams;

  const [sources, statuses, bootcamps, savedViews, tags] = await Promise.all([
    getLeadSources(),
    getLeadStatuses(),
    getBootcamps(),
    getViewSettings("leads"),
    getTags(),
  ]);

  const leadsData = await getLeads({
    search: q,
    bootcampId: bootcamp,
    statusId: statusId,
    temperature: temperature === "hot" ? "hot" : temperature === "cold" ? "cold" : undefined,
    converted: converted === "true" ? true : converted === "false" ? false : undefined,
  });

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
            <NewLeadButton
              sources={sources}
              bootcamps={bootcamps.map((b) => ({
                id: b.id,
                label: b.startDate ? `${b.name} — ${formatDate(b.startDate)}` : b.name,
              }))}
            />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <LeadsList
          leads={leadsData}
          filterBootcampId={bootcamp || null}
          filterStatusId={statusId || null}
          filterTemperature={temperature || null}
          filterConverted={converted || null}
          bootcamps={bootcamps.map((b) => ({ id: b.id, name: b.name }))}
          statuses={statuses.map((s) => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            bootcampId: s.bootcampId,
          }))}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        />
      </div>
    </>
  );
}
