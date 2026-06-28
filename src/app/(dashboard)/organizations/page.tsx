import { redirect } from "next/navigation";
import { getOrganizations, getIndustries, getTerritories, getViewSettings } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { DataTable, TextCell, DateCell } from "@/components/data-table";
import { NewOrganizationButton } from "@/components/organizations/new-organization-button";
import { SearchBar } from "@/components/search-bar";
import { SavedViewsDropdown } from "@/components/saved-views-dropdown";

export const dynamic = "force-dynamic";

export default async function OrganizationsPage() {
  // B2B masqué de l'usage quotidien : route débranchée (impl. legacy conservée ci-dessous, chantier séparé).
  redirect("/leads");
}

async function OrganizationsPageLegacy({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [organizations, industries, territories, savedViews] = await Promise.all([
    getOrganizations(q),
    getIndustries(),
    getTerritories(),
    getViewSettings("organizations"),
  ]);

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle={`${organizations.length} organisation${organizations.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <SavedViewsDropdown
              routeName="organizations"
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
            <NewOrganizationButton industries={industries} territories={territories} />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={[
            {
              key: "name",
              label: "Name",
              className: "pl-5",
              render: (o) => (
                <span className="text-sm font-medium text-foreground group-hover:text-primary">
                  {o.name}
                </span>
              ),
            },
            {
              key: "website",
              label: "Website",
              render: (o) => <TextCell value={o.website} />,
            },
            {
              key: "industry",
              label: "Industry",
              render: (o) => <TextCell value={o.industry?.name} />,
            },
            {
              key: "noOfEmployees",
              label: "Employees",
              render: (o) => <TextCell value={o.noOfEmployees} />,
            },
            {
              key: "annualRevenue",
              label: "Revenue",
              render: (o) =>
                o.annualRevenue ? (
                  <span className="text-sm text-muted-foreground">
                    {Number(o.annualRevenue).toLocaleString("fr-FR")} €
                  </span>
                ) : (
                  <TextCell value={null} />
                ),
            },
            {
              key: "createdAt",
              label: "Created",
              align: "right",
              className: "pr-5",
              render: (o) => <DateCell value={o.createdAt} />,
            },
          ]}
          rows={organizations}
          emptyTitle="Aucune organisation"
          emptySubtitle="Créez votre première organisation pour commencer."
          getHref={(o) => `/organizations/${o.id}`}
        />
      </div>
    </>
  );
}
