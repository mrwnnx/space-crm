import "server-only";
import { db } from "@/db";
import { contacts, leads } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { carryLeadsOver, createActivity, getLeadById, moveLeadToStage, updateLead } from "@/lib/queries";
import { recordWhatsAppSent } from "@/lib/whatsapp-inbox";
import { codeValable, prixAvecCode } from "@/lib/promo";

/*
 * Le formulaire WhatsApp « نحب نسجل » (Meta Flow `inscription_session_suivante`,
 * JSON dans whatsapp/flow-inscription.json).
 *
 * À l'envoi : chaque personne reçoit ce qu'on sait déjà d'elle — le formulaire
 * n'affiche que les champs manquants, ou un simple « Confirmer » s'il ne manque
 * rien (mesuré le 25/09 : 126 leads de septembre sur 373 avaient tout).
 * Au retour : fiche complétée, report vers la formation active (colonne
 * Intéressé), remerciement.
 */

// Le jeton qui revient avec la réponse : c'est lui qui dit de quelle fiche il s'agit.
const PREFIXE = "inscr:";

// Le formulaire publié chez Meta (25/09) — non modifiable : un changement = un nouveau formulaire.
// La version 2 (champ email, whatsapp/flow-inscription.json) attend sa publication :
// mettre son identifiant ici l'active. L'ancienne ne connaît pas `need_email`.
const FLOW_AVEC_EMAIL_ID: string | null = "1127437653274034"; // publiée le 26/09
export const FLOW_INSCRIPTION_ID = FLOW_AVEC_EMAIL_ID ?? "28866668219686929";

const SITUATIONS = ["نخدم", "نقرا", "مانيش نخدم", "فريلانس", "حاجة أخرى"];

export async function donneesFlowInscription(
  leadId: string | null | undefined,
  // La session visée, choisie à l'envoi ; à défaut, celle qui reçoit les formulaires du site.
  formationId?: string | null
) {
  const lead = leadId ? await getLeadById(leadId) : null;
  const formation = formationId ?? (await formationActive())?.id ?? null;
  const need_age = lead?.contact?.age == null;
  const need_situation = !lead?.jobTitle?.trim();
  const need_plan = !lead?.intendedPlan;
  const need_email = !!FLOW_AVEC_EMAIL_ID && !lead?.email?.trim() && !lead?.contact?.email?.trim();
  const rien = !need_age && !need_situation && !need_plan && !need_email;
  const formules = await formulesAvecPrix(formation, lead?.promoCodeId, lead?.id);
  return {
    token: lead ? `${PREFIXE}${lead.id}${formationId ? `:${formationId}` : ""}` : "unused",
    data: {
      intro: rien
        ? "المعلومات متاعك الكل عندنا ✅ اضغط على « أكد التسجيل » ونكلموك قريب."
        : "كمل هالمعلومات باش نسجلوك في الدورة الجاية 👇",
      need_age,
      need_situation,
      need_plan,
      ...(FLOW_AVEC_EMAIL_ID ? { need_email } : {}),
      formules,
    },
  };
}

// Le code annoncé dans le modèle « formation complète » (bouton « copier le code »).
const CODE_DU_MODELE = "NEXTLEVEL20";

/**
 * Le code qui fixe les prix du formulaire : celui que la personne a tapé s'il
 * vaut pour cette session, sinon celui du modèle — seulement si elle a REÇU ce
 * modèle. Sans code, prix normal (Balkis, 26/09 : une remise sans code).
 */
async function codePourFlow(promoCodeId: string | null | undefined, formationId: string | null, leadId?: string | null) {
  const codes = await db.query.promoCodes.findMany();
  const sien = codes.find((c) => c.id === promoCodeId);
  if (sien && codeValable(sien, formationId)) return sien;
  const modele = codes.find((c) => c.code === CODE_DU_MODELE);
  if (!modele || !codeValable(modele, formationId) || !leadId) return null;
  const [recu] = await db.execute<{ ok: number }>(sql`
    select 1 as ok from whatsapp_messages m
    join activities a on a.id = m.activity_id
    join leads x on x.id = a.reference_id
    where m.template like 'formation_complete%'
      and right(regexp_replace(coalesce(x.mobile_no, ''), '\\D', '', 'g'), 8) =
          (select right(regexp_replace(coalesce(mobile_no, ''), '\\D', '', 'g'), 8) from leads where id = ${leadId})
    limit 1`);
  return recu ? modele : null;
}

/**
 * Les deux formules avec le prix de la session visée, remise déjà faite, et
 * le prix normal en petit : le prix se lit au moment de choisir, pas après.
 */
async function formulesAvecPrix(formationId: string | null, promoCodeId?: string | null, leadId?: string | null) {
  const [b] = formationId
    ? await db.execute<{ price_total: string | null; monthly_count: number | null; monthly_amount: string | null; currency: string }>(sql`
        select price_total::text, monthly_count, monthly_amount::text, currency from bootcamps where id = ${formationId}`)
    : [];
  const devise = !b?.currency || b.currency === "TND" ? "دينار" : b.currency;
  const normal = (v: string) => String(Number(v));
  const code = b ? await codePourFlow(promoCodeId, formationId, leadId) : null;
  const prix = code && b ? prixAvecCode({ priceTotal: b.price_total, monthlyCount: b.monthly_count, monthlyAmount: b.monthly_amount }, code) : null;
  const pct = (v: string | null) => String(Number(v));
  return [
    b?.price_total
      ? prix?.total != null
        ? { id: "total", title: `مرة وحدة — ${prix.total} ${devise}`, description: `عوض ${normal(b.price_total)} ${devise}، تخفيض ${pct(code!.remiseTotalPct)}%` }
        : { id: "total", title: `مرة وحدة — ${normal(b.price_total)} ${devise}` }
      : { id: "total", title: "مرة وحدة" },
    // La remise « facilité » n'existe que si le code la prévoit (décision du 25/09 : NEXTLEVEL20 non).
    b?.monthly_count && b.monthly_amount
      ? prix?.mensualite != null
        ? {
            id: "monthly",
            title: `على ${b.monthly_count} أقساط — ${b.monthly_count} × ${prix.mensualite} ${devise}`,
            description: `عوض ${b.monthly_count} × ${normal(b.monthly_amount)} ${devise}، تخفيض ${pct(code!.remiseFacilitePct)}%`,
          }
        : { id: "monthly", title: `على ${b.monthly_count} أقساط — ${b.monthly_count} × ${normal(b.monthly_amount)} ${devise}` }
      : { id: "monthly", title: "على أقساط (كل شهر)" },
  ];
}

/**
 * La formation où arrivent aujourd'hui les nouvelles inscriptions : celle qui
 * reçoit les formulaires du site. Après une duplication, elle suit toute seule.
 */
export async function formationActive() {
  const [b] = await db.execute<{ id: string; name: string }>(sql`
    select b.id, b.name from bootcamps b
    where b.archived_at is null and b.status not in ('completed', 'cancelled')
      and exists (select 1 from form_sources f where f.bootcamp_id = b.id and f.active)
    order by b.start_date desc nulls last, b.created_at desc
    limit 1`);
  return b ?? null;
}

async function colonneInteresse(bootcampId: string) {
  const [s] = await db.execute<{ id: string }>(sql`
    select id from lead_statuses where bootcamp_id = ${bootcampId} and kind = 'normal'
    order by (name ilike 'intéress%') desc, position asc limit 1`);
  return s?.id ?? null;
}

async function formationParId(id: string) {
  const [b] = await db.execute<{ id: string; name: string }>(sql`select id, name from bootcamps where id = ${id}`);
  return b ?? null;
}

/** La fiche que cette personne a déjà dans cette formation (même contact ou même email). */
async function ficheDansFormation(leadId: string, bootcampId: string) {
  const [f] = await db.execute<{ id: string }>(sql`
    select t.id from leads t, leads o
    where o.id = ${leadId} and t.bootcamp_id = ${bootcampId}
      and ((o.contact_id is not null and t.contact_id = o.contact_id)
        or (coalesce(o.email, '') <> '' and lower(trim(t.email)) = lower(trim(o.email))))
    order by t.created_at desc limit 1`);
  return f?.id ?? null;
}

/** En Intéressé, sauf si déjà inscrite (on ne fait jamais reculer une inscription). */
async function passerEnInteresse(leadId: string, colonne: string) {
  const [l] = await db.execute<{ status_id: string | null; kind: string | null }>(sql`
    select l.status_id, s.kind::text as kind from leads l left join lead_statuses s on s.id = l.status_id where l.id = ${leadId}`);
  if (!l || l.status_id === colonne || l.kind === "converted") return;
  // Déjà plus loin (Contacté, Payment pending…) : le formulaire ne fait pas reculer.
  const { dejaPlusLoin } = await import("@/lib/pipeline-whatsapp");
  if (await dejaPlusLoin(leadId, colonne)) return;
  await moveLeadToStage(leadId, colonne);
  const { runStatusAutomations } = await import("@/lib/automations");
  await runStatusAutomations(leadId, colonne);
}

/** Réponse du formulaire (webhook `nfm_reply`). Ne jette jamais : un échec ne doit pas bloquer le webhook. */
export async function traiterReponseFlow(input: { responseJson: string; leadIdRecu: string | null }) {
  try {
    const r = JSON.parse(input.responseJson) as Record<string, unknown>;
    // Jeton : « inscr:<lead> » ou « inscr:<lead>:<formation choisie à l'envoi> ».
    const token = String(r.flow_token ?? "");
    const [leadIdJeton, formationJeton] = token.startsWith(PREFIXE) ? token.slice(PREFIXE.length).split(":") : [];
    const leadId = leadIdJeton || input.leadIdRecu;
    const lead = leadId ? await getLeadById(leadId) : null;
    if (!lead) return;

    // Ce que la personne vient de répondre REMPLACE l'ancien (décision du 25/09).
    // Un champ caché revient vide : il ne touche à rien.
    const age = Number(String(r.age ?? "").trim());
    const situation = String(r.situation ?? "").trim();
    const formule = String(r.formule ?? "").trim();
    const recu: string[] = [];
    if (Number.isInteger(age) && age >= 10 && age <= 99 && lead.contactId) {
      await db.update(contacts).set({ age }).where(eq(contacts.id, lead.contactId));
      recu.push(`âge ${age}`);
    }
    const maj: Partial<typeof leads.$inferInsert> = {};
    if (SITUATIONS.includes(situation)) {
      maj.jobTitle = situation;
      recu.push(`situation « ${situation} »`);
    }
    if (formule === "total" || formule === "monthly") {
      maj.intendedPlan = formule;
      recu.push(formule === "total" ? "paiement en une fois" : "paiement mensuel");
    }
    const email = String(r.email ?? "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      maj.email = email;
      recu.push(`email ${email}`);
      if (lead.contactId) {
        await db.update(contacts).set({ email }).where(and(eq(contacts.id, lead.contactId), sql`coalesce(trim(${contacts.email}), '') = ''`));
      }
    }
    if (Object.keys(maj).length > 0) await updateLead(lead.id, maj);

    // Elle a rempli le formulaire depuis WhatsApp : elle accepte d'y être contactée.
    if (lead.contactId) {
      await db
        .update(contacts)
        .set({ whatsappConsentAt: new Date(), whatsappConsentSource: "Formulaire WhatsApp « نحب نسجل »" })
        .where(and(eq(contacts.id, lead.contactId), sql`${contacts.whatsappConsentAt} is null`, sql`${contacts.whatsappUnsubscribedAt} is null`));
    }

    // La fiche de la session visée, colonne Intéressé : reportée, déjà là, ou elle-même.
    const cible = formationJeton ? await formationParId(formationJeton) : await formationActive();
    let fiche = lead.id;
    let destination = "";
    if (cible) {
      const colonne = await colonneInteresse(cible.id);
      if (cible.id === lead.bootcampId) {
        fiche = lead.id;
      } else {
        // Report en 1ʳᵉ colonne, puis VRAI déplacement vers Intéressé : c'est lui
        // qui déclenche les envois et tags de la colonne (le report n'en lance aucun).
        const [nouveau] = await carryLeadsOver([lead.id], cible.id, "whatsapp");
        fiche = nouveau ?? (await ficheDansFormation(lead.id, cible.id)) ?? lead.id;
        if (nouveau) destination = cible.name;
      }
      if (fiche !== lead.id) {
        // La fiche d'arrivée porte aussi les réponses ; la formule, le report ne la recopie pas.
        const plan = maj.intendedPlan ?? lead.intendedPlan;
        await updateLead(fiche, { ...maj, ...(plan ? { intendedPlan: plan } : {}) });
      }
      if (colonne) await passerEnInteresse(fiche, colonne);
    }

    await createActivity({
      referenceType: "lead",
      referenceId: fiche,
      type: "note",
      direction: "inbound",
      subject: "Formulaire WhatsApp « نحب نسجل » rempli",
      content: [
        destination ? `Inscrite pour « ${destination} » depuis WhatsApp.` : "Confirmation d'intérêt depuis WhatsApp.",
        recu.length ? `Complété : ${recu.join(", ")}.` : "Aucune information manquante.",
      ].join("\n"),
      createdBy: "whatsapp",
    });

    if (lead.mobileNo) {
      const corps = "يعيشك ✅ وصلتنا المعلومات متاعك، باش نكلموك قريب باش نكملو التسجيل 🙏";
      const envoi = await sendWhatsApp({ to: lead.mobileNo, body: corps });
      if (envoi.ok) {
        const activite = await createActivity({
          referenceType: "lead",
          referenceId: fiche,
          type: "whatsapp",
          direction: "outbound",
          subject: "Réponse automatique au formulaire « نحب نسجل »",
          content: corps,
          createdBy: "automation",
        });
        if (envoi.sid) await recordWhatsAppSent(envoi.sid, activite.id);
      } else {
        console.error("Formulaire WhatsApp — remerciement non envoyé :", envoi.error);
      }
    }
  } catch (e) {
    console.error("Formulaire WhatsApp :", e);
  }
}
