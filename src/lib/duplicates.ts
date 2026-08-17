import "server-only";
import { db } from "@/db";
import { contacts, leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export type DuplicateLead = {
  id: string;
  fullName: string;
  email: string | null;
  createdAt: Date;
  converted: boolean;
  bootcampName: string | null;
  /** partage aussi le contact — donc les campagnes ne touchent qu'une des fiches */
  sameContact: boolean;
};

export type DuplicateInfo = {
  others: DuplicateLead[];
  /** vrai si un autre lead porte un nom différent : c'est là qu'il faut vérifier */
  nameDiffers: boolean;
  dismissed: boolean;
};

/**
 * Autres leads portant la MÊME adresse email.
 *
 * Distinction qui porte tout le reste : même adresse + même nom = quelqu'un
 * qui se réinscrit, c'est sain. Même adresse + nom différent = deux personnes
 * possiblement confondues. Alerter sur les deux ferait du bruit, et une alerte
 * qu'on apprend à ignorer ne sert plus à rien.
 */
export async function getDuplicateInfo(leadId: string): Promise<DuplicateInfo | null> {
  const [self] = await db
    .select({
      id: leads.id,
      email: leads.email,
      fullName: leads.fullName,
      contactId: leads.contactId,
      dismissedAt: leads.duplicateDismissedAt,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!self?.email?.trim()) return null;

  const rows = await db.execute<DuplicateLead>(sql`
    select
      l.id                                   as id,
      l.full_name                            as "fullName",
      l.email                                as email,
      l.created_at                           as "createdAt",
      l.converted                            as converted,
      b.name                                 as "bootcampName",
      (l.contact_id is not distinct from ${self.contactId}) as "sameContact"
      from leads l
      left join bootcamps b on b.id = l.bootcamp_id
     where lower(trim(l.email)) = ${self.email.trim().toLowerCase()}
       and l.id <> ${leadId}
     order by l.created_at
  `);

  const others = rows as unknown as DuplicateLead[];
  if (others.length === 0) return null;

  const norm = (s: string) => s.trim().toLowerCase();
  return {
    others,
    nameDiffers: others.some((o) => norm(o.fullName) !== norm(self.fullName)),
    dismissed: !!self.dismissedAt,
  };
}

/** « C'est la même personne » — l'alerte ne reviendra plus sur ce lead. */
export async function dismissDuplicate(leadId: string) {
  await db
    .update(leads)
    .set({ duplicateDismissedAt: new Date() })
    .where(eq(leads.id, leadId));
}

/**
 * « Ce sont deux personnes » — ce lead part sur son propre contact.
 *
 * Sans ça, les deux fiches partagent une seule adresse de contact : une
 * campagne n'en touche qu'une, et le revenu des deux est crédité au même
 * endroit.
 */
export async function separateLeadFromContact(
  leadId: string
): Promise<{ ok: boolean; contactId?: string; error?: string }> {
  const [lead] = await db
    .select({
      id: leads.id,
      fullName: leads.fullName,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      mobileNo: leads.mobileNo,
      contactId: leads.contactId,
    })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (!lead) return { ok: false, error: "Lead introuvable" };
  if (!lead.contactId) return { ok: false, error: "Ce lead n'a pas de contact" };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.contactId, lead.contactId));

  if (n <= 1) {
    return { ok: false, error: "Ce lead a déjà son propre contact" };
  }

  // Contact neuf plutôt que réutilisation par email : ici on affirme
  // justement que ce sont DEUX personnes, même si l'adresse est commune.
  const [created] = await db
    .insert(contacts)
    .values({
      fullName: lead.fullName,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      mobileNo: lead.mobileNo,
    })
    .returning({ id: contacts.id });

  await db
    .update(leads)
    .set({ contactId: created.id, duplicateDismissedAt: new Date() })
    .where(eq(leads.id, leadId));

  return { ok: true, contactId: created.id };
}
