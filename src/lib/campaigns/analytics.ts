import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/** Fenêtre d'attribution : au-delà, on ne prête plus l'inscription à l'email. */
const ATTRIBUTION_DAYS = 30;

export type CampaignStats = {
  campaignId: string;
  recipients: number;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  skipped: number;
  pending: number;
  failed: number;
  opened: number;
  clicked: number;
  /** désinscriptions déclenchées PAR cette campagne */
  unsubscribed: number;
  /** en % des envoyés, arrondi à l'entier */
  openRate: number;
  clickRate: number;
  bounceRate: number;
  /** inscriptions attribuées à cette campagne */
  conversions: number;
  /** somme réellement ENCAISSÉE par ces inscrits (pas le prix affiché) */
  revenue: number;
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/**
 * Statistiques d'une campagne, revenu compris.
 *
 * Attribution AU DERNIER CONTACT : l'inscription est créditée à la dernière
 * campagne reçue avant la conversion, dans une fenêtre de 30 jours. C'est le
 * seul modèle où la somme des revenus par campagne égale le revenu réel —
 * aucun double comptage.
 */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const [row] = await db.execute<{
    recipients: number;
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    skipped: number;
    pending: number;
    failed: number;
    opened: number;
    clicked: number;
    unsubscribed: number;
  }>(sql`
    select
      count(*)::int                                                   as recipients,
      count(*) filter (where status = 'sent')::int                    as sent,
      count(*) filter (where delivered_at is not null)::int           as delivered,
      count(*) filter (where status = 'bounced')::int                 as bounced,
      count(*) filter (where status = 'complained')::int              as complained,
      count(*) filter (where status = 'skipped')::int                 as skipped,
      count(*) filter (where status = 'pending')::int                 as pending,
      count(*) filter (where status = 'failed')::int                  as failed,
      count(*) filter (where opened_at is not null)::int              as opened,
      count(*) filter (where clicked_at is not null)::int             as clicked,
      count(*) filter (where unsubscribed_at is not null)::int        as unsubscribed
    from campaign_recipients
    where campaign_id = ${campaignId}
  `);

  const [rev] = await db.execute<{ conversions: number; revenue: number }>(sql`
    with attribution as (
      -- DISTINCT ON garde, pour chaque lead converti, la DERNIÈRE campagne
      -- reçue avant sa conversion : un seul crédit par inscription.
      select distinct on (l.id) l.id as lead_id, cr.campaign_id
        from leads l
        join contacts c            on c.id  = l.contact_id
        join campaign_recipients cr on cr.contact_id = c.id
       where l.converted = true
         and l.converted_at is not null
         and cr.sent_at is not null
         and cr.sent_at <= l.converted_at
         and cr.sent_at >= l.converted_at - interval '${sql.raw(String(ATTRIBUTION_DAYS))} days'
       order by l.id, cr.sent_at desc
    )
    select
      count(distinct a.lead_id)::int                                            as conversions,
      coalesce(sum(ps.amount::numeric) filter (where ps.is_paid), 0)::float8     as revenue
      from attribution a
      left join payment_schedules ps on ps.lead_id = a.lead_id
     where a.campaign_id = ${campaignId}
  `);

  const sent = Number(row?.sent ?? 0);
  return {
    campaignId,
    recipients: Number(row?.recipients ?? 0),
    sent,
    delivered: Number(row?.delivered ?? 0),
    bounced: Number(row?.bounced ?? 0),
    complained: Number(row?.complained ?? 0),
    skipped: Number(row?.skipped ?? 0),
    pending: Number(row?.pending ?? 0),
    failed: Number(row?.failed ?? 0),
    opened: Number(row?.opened ?? 0),
    clicked: Number(row?.clicked ?? 0),
    unsubscribed: Number(row?.unsubscribed ?? 0),
    openRate: pct(Number(row?.opened ?? 0), sent),
    clickRate: pct(Number(row?.clicked ?? 0), sent),
    bounceRate: pct(Number(row?.bounced ?? 0), sent),
    conversions: Number(rev?.conversions ?? 0),
    revenue: Number(rev?.revenue ?? 0),
  };
}

/** Les campagnes reçues par UNE personne — l'historique de sa fiche lead. */
export type LeadCampaignRow = {
  campaignId: string;
  name: string;
  subject: string | null;
  status: string;
  sentAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
};

export async function getCampaignsForContact(
  contactId: string
): Promise<LeadCampaignRow[]> {
  const rows = await db.execute<LeadCampaignRow>(sql`
    select
      c.id        as "campaignId",
      c.name      as name,
      c.subject   as subject,
      cr.status   as status,
      cr.sent_at  as "sentAt",
      cr.opened_at  as "openedAt",
      cr.clicked_at as "clickedAt"
      from campaign_recipients cr
      join campaigns c on c.id = cr.campaign_id
     where cr.contact_id = ${contactId}
     order by cr.sent_at desc nulls last, c.created_at desc
  `);
  return rows as unknown as LeadCampaignRow[];
}

export type LinkClickRow = { url: string; clicks: number; people: number };

/** Quel lien a marché — agrégé par URL, avec le nombre de personnes distinctes. */
export async function getLinkClicks(campaignId: string): Promise<LinkClickRow[]> {
  const rows = await db.execute<LinkClickRow>(sql`
    select url,
           count(*)::int                        as clicks,
           count(distinct recipient_id)::int    as people
      from campaign_link_clicks
     where campaign_id = ${campaignId}
     group by url
     order by clicks desc
  `);
  return rows as unknown as LinkClickRow[];
}
