import { countLeads, getLeads, getLeadSources, getLeadStatuses, getBootcamps, getViewSettings, getTags } from "@/lib/queries";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { LeadsList } from "@/components/leads/leads-list";
import { NewLeadButton } from "@/components/leads/new-lead-button";
import { SearchBar } from "@/components/search-bar";
import { SavedViewsDropdown } from "@/components/saved-views-dropdown";

export const dynamic = "force-dynamic";

const PAR_PAGE = [30, 50, 100];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bootcamp?: string; statusId?: string; temperature?: string; converted?: string; tag?: string; tagMode?: string; page?: string; perPage?: string }>;
}) {
  const { q, bootcamp, statusId, temperature, converted, tag, tagMode, page, perPage } = await searchParams;
  const tagIds = (tag || "").split(",").filter(Boolean);
  // Une page à la fois : charger les 10 000 leads à chaque ouverture coûtait
  // 1,5 Mo de transfert Supabase (quota du palier gratuit dépassé en septembre).
  const parPage = PAR_PAGE.includes(Number(perPage)) ? Number(perPage) : 50;
  const pageDemandee = Math.max(1, Math.floor(Number(page)) || 1);

  const [sources, statuses, bootcamps, savedViews, tags] = await Promise.all([
    getLeadSources(),
    getLeadStatuses(),
    getBootcamps(),
    getViewSettings("leads"),
    getTags(),
  ]);

  const filtres = {
    search: q,
    bootcampId: bootcamp,
    statusId: statusId,
    temperature: temperature === "hot" ? ("hot" as const) : temperature === "cold" ? ("cold" as const) : undefined,
    converted: converted === "true" ? true : converted === "false" ? false : undefined,
    tagIds,
    tagMode: tagMode === "all" ? ("all" as const) : ("any" as const),
  };
  const total = await countLeads(filtres);
  // Une page au-delà de la dernière (après une suppression) retombe sur la dernière.
  const pageCourante = Math.min(pageDemandee, Math.max(1, Math.ceil(total / parPage)));
  const leadsData = await getLeads({ ...filtres, limit: parPage, offset: (pageCourante - 1) * parPage });

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${total} lead${total > 1 ? "s" : ""}`}
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
          total={total}
          page={pageCourante}
          perPage={parPage}
          filterBootcampId={bootcamp || null}
          filterStatusId={statusId || null}
          filterTemperature={temperature || null}
          filterConverted={converted || null}
          filterTagIds={tagIds}
          filterTagMode={tagMode === "all" ? "all" : "any"}
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
