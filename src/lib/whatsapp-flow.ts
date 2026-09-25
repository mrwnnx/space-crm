import "server-only";
import { db } from "@/db";
import { contacts, leads } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendWhatsApp } from "@/lib/messaging/whatsapp";
import { carryLeadsOver, createActivity, getLeadById, updateLead } from "@/lib/queries";
import { recordWhatsAppSent } from "@/lib/whatsapp-inbox";

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

const SITUATIONS = ["نخدم", "نقرا", "مانيش نخدم", "فريلانس", "حاجة أخرى"];

export async function donneesFlowInscription(leadId: string | null | undefined) {
  const lead = leadId ? await getLeadById(leadId) : null;
  const need_age = lead?.contact?.age == null;
  const need_situation = !lead?.jobTitle?.trim();
  const need_plan = !lead?.intendedPlan;
  const rien = !need_age && !need_situation && !need_plan;
  const formules = await formulesAvecPrix();
  return {
    token: lead ? `${PREFIXE}${lead.id}` : "unused",
    data: {
      intro: rien
        ? "المعلومات متاعك الكل عندنا ✅ اضغط على « أكد التسجيل » ونكلموك قريب."
        : "كمل هالمعلومات باش نسجلوك في الدورة الجاية 👇",
      need_age,
      need_situation,
      need_plan,
      formules,
    },
  };
}

/**
 * Les deux formules avec le prix de la session où la personne va s'inscrire
 * (la formation active) : le prix se lit au moment de choisir, pas après.
 */
async function formulesAvecPrix() {
  const f = await formationActive();
  const [b] = f
    ? await db.execute<{ price_total: string | null; monthly_count: number | null; monthly_amount: string | null; currency: string }>(sql`
        select price_total::text, monthly_count, monthly_amount::text, currency from bootcamps where id = ${f.id}`)
    : [];
  const devise = !b?.currency || b.currency === "TND" ? "DT" : b.currency;
  const montant = (v: string | null) => (v ? String(Number(v)) : "");
  return [
    { id: "total", title: b?.price_total ? `مرة وحدة — ${montant(b.price_total)} ${devise}` : "مرة وحدة" },
    {
      id: "monthly",
      title:
        b?.monthly_count && b.monthly_amount
          ? `على ${b.monthly_count} أقساط — ${b.monthly_count} × ${montant(b.monthly_amount)} ${devise}`
          : "على أقساط (كل شهر)",
    },
  ];
}

/**
 * La formation où arrivent aujourd'hui les nouvelles inscriptions : celle qui
 * reçoit les formulaires du site. Après une duplication, elle suit toute seule.
 */
async function formationActive() {
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

/** Réponse du formulaire (webhook `nfm_reply`). Ne jette jamais : un échec ne doit pas bloquer le webhook. */
export async function traiterReponseFlow(input: { responseJson: string; leadIdRecu: string | null }) {
  try {
    const r = JSON.parse(input.responseJson) as Record<string, unknown>;
    const token = String(r.flow_token ?? "");
    const leadId = token.startsWith(PREFIXE) ? token.slice(PREFIXE.length) : input.leadIdRecu;
    const lead = leadId ? await getLeadById(leadId) : null;
    if (!lead) return;

    // Les champs arrivent vides quand ils étaient cachés : on ne complète que ce qui manque.
    const age = Number(String(r.age ?? "").trim());
    const situation = String(r.situation ?? "").trim();
    const formule = String(r.formule ?? "").trim();
    const recu: string[] = [];
    if (Number.isInteger(age) && age >= 10 && age <= 99 && lead.contactId && lead.contact?.age == null) {
      await db.update(contacts).set({ age }).where(eq(contacts.id, lead.contactId));
      recu.push(`âge ${age}`);
    }
    const maj: Partial<typeof leads.$inferInsert> = {};
    if (SITUATIONS.includes(situation) && !lead.jobTitle?.trim()) {
      maj.jobTitle = situation;
      recu.push(`situation « ${situation} »`);
    }
    if ((formule === "total" || formule === "monthly") && !lead.intendedPlan) {
      maj.intendedPlan = formule;
      recu.push(formule === "total" ? "paiement en une fois" : "paiement mensuel");
    }
    if (Object.keys(maj).length > 0) await updateLead(lead.id, maj);

    // Report vers la session active, dans la colonne Intéressé. Déjà dedans : on ne double pas.
    const cible = await formationActive();
    let fiche = lead.id;
    let destination = "";
    if (cible && cible.id !== lead.bootcampId) {
      const colonne = await colonneInteresse(cible.id);
      if (colonne) {
        const [nouveau] = await carryLeadsOver([lead.id], cible.id, "whatsapp", colonne);
        if (nouveau) {
          fiche = nouveau;
          destination = cible.name;
          // Le report ne recopie pas la formule (elle dépend de l'offre de la
          // session) ; ici la personne vient de la donner, ou l'avait déjà dite.
          const plan = maj.intendedPlan ?? lead.intendedPlan;
          if (plan) await updateLead(nouveau, { intendedPlan: plan });
          const { runStatusAutomations } = await import("@/lib/automations");
          await runStatusAutomations(nouveau, colonne);
        }
      }
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
