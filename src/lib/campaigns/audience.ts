import "server-only";
import { db } from "@/db";
import { contacts, leads, leadTags } from "@/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

export type AudienceMember = {
  contactId: string | null;
  email: string;
  fullName: string | null;
  unsubscribeToken: string | null;
};

export type AudienceResolution = {
  recipients: AudienceMember[];
  stats: {
    /** contacts atteints par les tags, avant tout filtre */
    matched: number;
    /** écartés : désabonnés */
    unsubscribed: number;
    /** écartés : adresse invalide (rebond dur constaté) */
    bounced: number;
    /** écartés : aucune adresse email */
    noEmail: number;
    /** écartés : la même adresse apparaissait plusieurs fois */
    duplicates: number;
    /** adresses saisies à la main ne correspondant à aucun contact */
    unknownEmails: number;
    /** ce qui partira réellement */
    total: number;
  };
  /** adresses écartées faute d'exister dans le CRM (affichées à l'utilisateur) */
  ignoredEmails: string[];
};

const normalize = (e: string) => e.trim().toLowerCase();

/**
 * Résout la cible d'une campagne : tags (union) + adresses saisies à la main.
 *
 * Fonction UNIQUE, appelée par l'aperçu comme par l'envoi. C'est délibéré :
 * si le compteur affiché et la liste envoyée venaient de deux codes
 * différents, ils divergeraient tôt ou tard, et l'écart ne se verrait qu'une
 * fois les mails partis.
 *
 * Trois exclusions, toujours dans cet ordre : sans email, désabonné, doublon.
 */
export async function resolveCampaignAudience(input: {
  tagIds?: string[];
  emails?: string[];
}): Promise<AudienceResolution> {
  const tagIds = input.tagIds ?? [];
  const rawEmails = (input.emails ?? []).map(normalize).filter(Boolean);

  let matched = 0;
  let noEmail = 0;
  let unsubscribed = 0;
  let bounced = 0;
  let duplicates = 0;
  let unknownEmails = 0;

  const byEmail = new Map<string, AudienceMember>();
  const ignored: string[] = [];

  // ── 1. Les tags (union : un lead dans deux tags cochés ne compte qu'une fois)
  if (tagIds.length > 0) {
    const rows = await db
      .selectDistinct({
        contactId: contacts.id,
        email: contacts.email,
        fullName: contacts.fullName,
        unsubscribeToken: contacts.unsubscribeToken,
        unsubscribedAt: contacts.unsubscribedAt,
        bouncedAt: contacts.bouncedAt,
      })
      .from(leadTags)
      .innerJoin(leads, eq(leads.id, leadTags.leadId))
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .where(inArray(leadTags.tagId, tagIds));

    matched = rows.length;

    for (const r of rows) {
      if (!r.email || !r.email.trim()) {
        noEmail++;
        continue;
      }
      if (r.unsubscribedAt) {
        unsubscribed++;
        continue;
      }
      // Réenvoyer vers une adresse morte abîme la réputation du domaine
      // pour TOUS les autres destinataires.
      if (r.bouncedAt) {
        bounced++;
        continue;
      }
      const key = normalize(r.email);
      if (byEmail.has(key)) {
        duplicates++;
        continue;
      }
      byEmail.set(key, {
        contactId: r.contactId,
        email: r.email.trim(),
        fullName: r.fullName,
        unsubscribeToken: r.unsubscribeToken,
      });
    }
  }

  // ── 2. Les adresses saisies à la main
  if (rawEmails.length > 0) {
    // Rattachées à un contact quand il existe : sans ce rattachement, saisir
    // l'adresse d'un désabonné à la main contournerait son désabonnement.
    const known = await db
      .select({
        contactId: contacts.id,
        email: contacts.email,
        fullName: contacts.fullName,
        unsubscribeToken: contacts.unsubscribeToken,
        unsubscribedAt: contacts.unsubscribedAt,
        bouncedAt: contacts.bouncedAt,
      })
      .from(contacts)
      .where(
        and(
          isNotNull(contacts.email),
          inArray(sql`lower(${contacts.email})`, rawEmails)
        )
      );

    const knownByEmail = new Map(known.map((k) => [normalize(k.email!), k]));

    for (const key of rawEmails) {
      if (byEmail.has(key)) {
        duplicates++;
        continue;
      }
      const hit = knownByEmail.get(key);
      if (hit) {
        if (hit.unsubscribedAt) {
          unsubscribed++;
          continue;
        }
        if (hit.bouncedAt) {
          bounced++;
          continue;
        }
        byEmail.set(key, {
          contactId: hit.contactId,
          email: hit.email!.trim(),
          fullName: hit.fullName,
          unsubscribeToken: hit.unsubscribeToken,
        });
      } else {
        // Absente du CRM : pas de token, donc aucun moyen de se désinscrire.
        // On l'écarte plutôt que d'envoyer du marketing sans porte de sortie.
        unknownEmails++;
        ignored.push(key);
      }
    }
  }

  const recipients = [...byEmail.values()];

  return {
    recipients,
    ignoredEmails: ignored,
    stats: {
      matched,
      unsubscribed,
      bounced,
      noEmail,
      duplicates,
      unknownEmails,
      total: recipients.length,
    },
  };
}
