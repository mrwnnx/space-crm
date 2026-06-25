import { notFound } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { getContactById } from "@/lib/queries";
import { cn, initials, formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const contact = await getContactById(id);
  return { title: contact ? `${contact.fullName} — Academy CRM` : "Contact" };
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await getContactById(id);

  if (!contact) notFound();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-5">
        <Link
          href="/contacts"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Contacts
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
            {initials(contact.fullName)}
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground font-heading">
              {contact.fullName}
            </h1>
            {contact.organization && (
              <Link
                href={`/organizations/${contact.organization.id}`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {contact.organization.name}
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-3">
        {/* Left: contact info */}
        <div className="overflow-y-auto p-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Coordonnées
            </h2>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Email" value={contact.email} />
              <InfoRow label="Mobile" value={contact.mobileNo} />
              <InfoRow label="Téléphone" value={contact.phone} />
              <InfoRow
                label="Organisation"
                value={contact.organization?.name}
              />
              <InfoRow label="Créé le" value={formatDate(contact.createdAt)} />
            </dl>
          </div>
        </div>

        {/* Right: linked leads + deals */}
        <div className="overflow-y-auto p-5 lg:col-span-2">
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Leads liés ({contact.leads.length})
            </h2>
            <div className="space-y-2">
              {contact.leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(lead.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {lead.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {lead.email || lead.mobileNo || "—"}
                      </p>
                    </div>
                  </div>
                  {lead.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {lead.status.name}
                    </span>
                  )}
                </Link>
              ))}
              {contact.leads.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Aucun lead lié
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Deals liés ({contact.deals.length})
            </h2>
            <div className="space-y-2">
              {contact.deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {deal.organization?.name || "Deal"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deal.dealValue || "—"} €
                    </p>
                  </div>
                  {deal.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {deal.status.name}
                    </span>
                  )}
                </Link>
              ))}
              {contact.deals.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Aucun deal lié
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", value ? "text-foreground" : "text-muted-foreground/50")}>
        {value || "—"}
      </dd>
    </div>
  );
}
