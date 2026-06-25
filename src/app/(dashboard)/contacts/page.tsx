import { getContacts, getOrganizations, getViewSettings } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { DataTable, AvatarCell, TextCell, DateCell } from "@/components/data-table";
import { NewContactButton } from "@/components/contacts/new-contact-button";
import { SearchBar } from "@/components/search-bar";
import { SavedViewsDropdown } from "@/components/saved-views-dropdown";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [contacts, organizations, savedViews] = await Promise.all([
    getContacts(q),
    getOrganizations(),
    getViewSettings("contacts"),
  ]);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length > 1 ? "s" : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <SavedViewsDropdown
              routeName="contacts"
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
            <NewContactButton organizations={organizations} />
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        <DataTable
          columns={[
            {
              key: "fullName",
              label: "Name",
              className: "pl-5",
              render: (c) => (
                <AvatarCell
                  name={c.fullName}
                  subtitle={c.organization?.name}
                />
              ),
            },
            {
              key: "email",
              label: "Email",
              render: (c) => <TextCell value={c.email} />,
            },
            {
              key: "mobileNo",
              label: "Mobile",
              render: (c) => <TextCell value={c.mobileNo} />,
            },
            {
              key: "phone",
              label: "Phone",
              render: (c) => <TextCell value={c.phone} />,
            },
            {
              key: "organization",
              label: "Organization",
              render: (c) => <TextCell value={c.organization?.name} />,
            },
            {
              key: "createdAt",
              label: "Created",
              align: "right",
              className: "pr-5",
              render: (c) => <DateCell value={c.createdAt} />,
            },
          ]}
          rows={contacts}
          emptyTitle="Aucun contact"
          emptySubtitle="Créez votre premier contact pour commencer."
          getHref={(c) => `/contacts/${c.id}`}
        />
      </div>
    </>
  );
}
