import { notFound } from "next/navigation";
import Link from "next/link";
import { getDealById, getDealStatuses, getLostReasons, getEmailTemplates } from "@/lib/queries";
import { cn, statusColor, initials, formatDate, formatRelative } from "@/lib/utils";
import { DealDetailHeader } from "@/components/deals/deal-detail-header";
import { DealSidePanel } from "@/components/deals/deal-side-panel";
import { ActivityPanel } from "@/components/activities/activity-panel";
import { LinkedTasks } from "@/components/tasks/linked-tasks";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDealById(id);
  return { title: deal ? `Deal — Academy CRM` : "Deal" };
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealById(id);

  if (!deal) notFound();

  const [statuses, lostReasons, templates] = await Promise.all([
    getDealStatuses(),
    getLostReasons(),
    getEmailTemplates(),
  ]);

  const sc = deal.status ? statusColor(deal.status.color) : null;

  return (
    <>
      <DealDetailHeader
        dealId={deal.id}
        orgName={deal.organization?.name || null}
        orgId={deal.organizationId}
        statusId={deal.statusId}
        statuses={statuses}
        statusColor={sc}
        statusName={deal.status?.name}
        lostReasons={lostReasons}
        dealValue={deal.dealValue}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main: Activity panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ActivityPanel
            referenceType="deal"
            referenceId={deal.id}
            activities={deal.activities.map((a) => ({
              ...a,
              createdAt: a.createdAt.toISOString(),
            }))}
            comments={deal.comments.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
            }))}
            leadEmail={deal.email}
            leadMobile={deal.mobileNo}
            leadWhatsapp={deal.mobileNo}
            templates={templates}
          />
        </div>

        {/* Side panel */}
        <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-border bg-card">
          {/* Org block */}
          {deal.organization && (
            <Link
              href={`/organizations/${deal.organization.id}`}
              className="flex items-center gap-3 border-b border-border p-4 transition-colors hover:bg-muted/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                {deal.organization.name[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {deal.organization.name}
                </p>
                {deal.organization.website && (
                  <p className="truncate text-xs text-muted-foreground">
                    {deal.organization.website}
                  </p>
                )}
              </div>
            </Link>
          )}

          {/* Lead link */}
          {deal.lead && (
            <Link
              href={`/leads/${deal.lead.id}`}
              className="flex items-center gap-2 border-b border-border p-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {initials(deal.lead.fullName)}
              </div>
              <span>
                From lead: <span className="font-medium text-foreground">{deal.lead.fullName}</span>
              </span>
            </Link>
          )}

          {/* Deal fields */}
          <DealSidePanel
            dealId={deal.id}
            deal={{
              dealValue: deal.dealValue,
              probability: deal.probability,
              nextStep: deal.nextStep,
              expectedClosureDate: deal.expectedClosureDate,
              lostNotes: deal.lostNotes,
            }}
          />

          <LinkedTasks
            tasks={deal.tasks}
            referenceType="deal"
            referenceId={deal.id}
          />

          {/* Contacts linked */}
          {deal.contacts.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contacts ({deal.contacts.length})
              </p>
              <div className="space-y-1.5">
                {deal.contacts.map((c) => (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {initials(c.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">
                        {c.fullName}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {c.email || c.mobileNo || ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {deal.dealProducts.length > 0 && (
            <div className="border-t border-border p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Products ({deal.dealProducts.length})
              </p>
              <div className="space-y-1.5">
                {deal.dealProducts.map((dp) => (
                  <div
                    key={dp.id}
                    className="flex items-center justify-between rounded-md bg-muted/30 p-2"
                  >
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {dp.product.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {dp.qty} × {Number(dp.rate).toLocaleString("fr-FR")} €
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {Number(dp.amount).toLocaleString("fr-FR")} €
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lost reason */}
          {deal.lostReason && (
            <div className="border-t border-border p-4">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-xs font-semibold text-red-700">
                  Perdu: {deal.lostReason.name}
                </p>
                {deal.lostNotes && (
                  <p className="mt-1 text-xs text-red-600/80">
                    {deal.lostNotes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground">
            <div className="flex justify-between py-1">
              <span>Créé le</span>
              <span className="font-medium text-foreground">
                {formatDate(deal.createdAt)}
              </span>
            </div>
            {deal.closedDate && (
              <div className="flex justify-between py-1">
                <span>Fermé le</span>
                <span className="font-medium text-foreground">
                  {formatDate(deal.closedDate)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
