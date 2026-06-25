import { getContacts, getOrganizations } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { DataTable, AvatarCell, TextCell, DateCell } from "@/components/data-table";
import { NewContactButton } from "@/components/contacts/new-contact-button";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, organizations] = await Promise.all([
    getContacts(),
    getOrganizations(),
  ]);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length > 1 ? "s" : ""}`}
        actions={<NewContactButton organizations={organizations} />}
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
