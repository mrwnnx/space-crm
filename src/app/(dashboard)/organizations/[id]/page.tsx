import { notFound } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Building02Icon } from "@hugeicons/core-free-icons";
import { getOrganizationById } from "@/lib/queries";
import { cn, initials, formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const org = await getOrganizationById(id);
  return { title: org ? `${org.name} — Academy CRM` : "Organization" };
}

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganizationById(id);

  if (!org) notFound();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-5">
        <Link
          href="/organizations"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
          Organizations
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <HugeiconsIcon icon={Building02Icon} size={18} />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground font-heading">
              {org.name}
            </h1>
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {org.website}
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-3">
        {/* Left: org info */}
        <div className="overflow-y-auto p-5">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Informations
            </h2>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Website" value={org.website} />
              <InfoRow label="Industrie" value={org.industry?.name} />
              <InfoRow label="Territoire" value={org.territory?.name} />
              <InfoRow label="Employés" value={org.noOfEmployees} />
              <InfoRow
                label="Revenue annuel"
                value={org.annualRevenue ? `${Number(org.annualRevenue).toLocaleString("fr-FR")} €` : null}
              />
              <InfoRow label="Devise" value={org.currency} />
              <InfoRow label="Créé le" value={formatDate(org.createdAt)} />
            </dl>
          </div>
        </div>

        {/* Right: contacts + leads + deals */}
        <div className="overflow-y-auto p-5 lg:col-span-2">
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Contacts ({org.contacts.length})
            </h2>
            <div className="space-y-2">
              {org.contacts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {initials(c.fullName)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {c.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.email || c.mobileNo || "—"}
                    </p>
                  </div>
                </Link>
              ))}
              {org.contacts.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Aucun contact
                </p>
              )}
            </div>
          </section>

          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Leads ({org.leads.length})
            </h2>
            <div className="space-y-2">
              {org.leads.map((l) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {initials(l.fullName)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {l.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {l.email || l.mobileNo || "—"}
                      </p>
                    </div>
                  </div>
                  {l.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {l.status.name}
                    </span>
                  )}
                </Link>
              ))}
              {org.leads.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Aucun lead
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Deals ({org.deals.length})
            </h2>
            <div className="space-y-2">
              {org.deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {d.dealValue ? `${Number(d.dealValue).toLocaleString("fr-FR")} €` : "Deal"}
                    </p>
                  </div>
                  {d.status && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {d.status.name}
                    </span>
                  )}
                </Link>
              ))}
              {org.deals.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Aucun deal
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
