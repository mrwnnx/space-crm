import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiReplies, leads } from "@/db/schema";
import { estNumeroDeTest, sendWhatsApp } from "@/lib/messaging/whatsapp";
import { getWhatsAppSettings } from "@/lib/whatsapp-settings";
import { savoirActif } from "@/lib/ai/knowledge";

/*
 * L'assistant WhatsApp (lot 3). Pour chaque message reçu :
 *   1. il rédige une réponse avec ce que le CRM sait de la personne et son savoir ;
 *   2. une SECONDE lecture, indépendante, note la réponse sur 100 — elle voit
 *      la question, la conversation et le savoir (un juge qui ne voit pas la
 *      question déclare hors sujet une réponse juste) ;
 *   3. décision : prête (note ≥ seuil) · escalade (humain) · ignorée (robot).
 * L'argent (RIB, paiement, remboursement) va TOUJOURS à un humain.
 *
 * Mode « répétition » : rien ne part vers les leads ; seuls les numéros de
 * test (Marwen, Fatma) reçoivent pour de vrai, comme en mode automatique.
 */

const MODEL = "claude-opus-5";
// Le savoir est coupé au-delà : un prompt géant coûte cher et noie l'utile.
const MAX_SAVOIR = 120_000;

export const MESSAGE_ATTENTE = "شكرا على رسالتك 🙏 باش نرجعولك في أقرب وقت ممكن.";

// Les messages automatiques d'autres entreprises (vus le 25/09) : ne jamais
// leur répondre, sinon deux robots se parlent sans fin.
const ROBOT =
  /(merci d'avoir contacté|merci pour votre message\. nous ne sommes pas disponibles|thank you for contacting|this is an automated|réponse automatique|auto-?reply|nous vous répondrons dans les plus brefs délais)/i;

const Redaction = z.object({
  reponse: z.string(),
  sujetArgent: z.boolean(),
  robot: z.boolean(),
  intentionInscription: z.boolean(),
});

const Note = z.object({
  score: z.number(),
  raisons: z.string(),
});

function client() {
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
}

/** Ce que l'assistant sait de la personne : formation, prix, étape, paiements. */
async function contexteLead(leadId: string) {
  const [l] = await db.execute<Record<string, string | number | boolean | null>>(sql`
    select l.full_name, l.intended_plan::text as formule, l.converted, s.name as colonne,
           b.name as formation, b.start_date::text as debut, b.price_total::text as prix,
           b.monthly_count as nb_mois, b.monthly_amount::text as mensualite, b.currency as devise
    from leads l
    left join bootcamps b on b.id = l.bootcamp_id
    left join lead_statuses s on s.id = l.status_id
    where l.id = ${leadId}`);
  const paiements = await db.execute<{ montant: string | null; echeance: string | null; paye: boolean }>(sql`
    select amount::text as montant, due_date::text as echeance, is_paid as paye
    from payment_schedules where lead_id = ${leadId} order by due_date nulls last`);
  const [active] = await db.execute<{ name: string; debut: string | null; prix: string | null; nb_mois: number | null; mensualite: string | null }>(sql`
    select b.name, b.start_date::text as debut, b.price_total::text as prix, b.monthly_count as nb_mois, b.monthly_amount::text as mensualite
    from bootcamps b
    where b.archived_at is null and b.status not in ('completed', 'cancelled')
      and exists (select 1 from form_sources f where f.bootcamp_id = b.id and f.active)
    order by b.start_date desc nulls last limit 1`);
  const lignes = [
    `Personne : ${l?.full_name ?? "inconnue"}`,
    `Sa formation dans le CRM : ${l?.formation ?? "aucune"}${l?.debut ? ` (début ${l.debut})` : ""}, étape « ${l?.colonne ?? "?"} »${l?.converted ? ", INSCRITE" : ""}`,
    l?.prix ? `Prix de sa formation : ${l.prix} ${l.devise} en une fois${l.nb_mois ? `, ou ${l.nb_mois} × ${l.mensualite} ${l.devise}` : ""}` : "",
    l?.formule ? `Formule qu'elle a choisie : ${l.formule === "total" ? "en une fois" : "en plusieurs fois"}` : "",
    paiements.length
      ? `Ses échéances : ${paiements.map((p) => `${p.montant ?? "?"} (${p.echeance ?? "sans date"}) ${p.paye ? "payée" : "à payer"}`).join(" ; ")}`
      : "Aucun paiement enregistré.",
    active
      ? `Session où s'inscrivent les nouveaux : ${active.name}${active.debut ? `, début ${active.debut}` : ""}${active.prix ? `, ${active.prix} en une fois` : ""}${active.nb_mois ? ` ou ${active.nb_mois} × ${active.mensualite}` : ""}`
      : "",
  ];
  return lignes.filter(Boolean).join("\n");
}

/** Les derniers échanges avec ce NUMÉRO (une conversation = un numéro, pas une fiche). */
async function conversation(leadId: string) {
  const rows = await db.execute<{ direction: string; content: string | null; at: string; template: string | null }>(sql`
    select a.direction, a.content, a.created_at::text as at,
           (select m.template from whatsapp_messages m where m.activity_id = a.id limit 1) as template
    from activities a join leads x on x.id = a.reference_id
    where a.type = 'whatsapp' and a.reference_type = 'lead'
      and right(regexp_replace(coalesce(x.mobile_no, ''), '\\D', '', 'g'), 8) =
          (select right(regexp_replace(coalesce(mobile_no, ''), '\\D', '', 'g'), 8) from leads where id = ${leadId})
    order by a.created_at desc limit 12`);
  // Les envois de modèle d'avant le 25/09 sont notés « Variables : a · b » :
  // on retrouve le texte réellement lu (c'est lui qui annonce un code promo).
  const { texteDuModele } = await import("@/lib/messaging/whatsapp");
  const lignes = await Promise.all(
    rows.reverse().map(async (r) => {
      let texte = r.content ?? "";
      if (r.template && texte.startsWith("Variables : ")) {
        texte = (await texteDuModele(r.template, texte.slice(12).split(" · ")).catch(() => null)) ?? texte;
      }
      return `${r.direction === "inbound" ? "La personne" : "L'école"} : ${texte.slice(0, 900)}`;
    })
  );
  return lignes.join("\n");
}

async function savoirTexte() {
  const sources = await savoirActif();
  let t = "";
  for (const s of sources) {
    const bloc = `### ${s.title}${s.kind === "souvenir" ? " (réponse déjà validée par l'équipe)" : ""}\n${s.content}\n\n`;
    if (t.length + bloc.length > MAX_SAVOIR) break;
    t += bloc;
  }
  return t || "(aucun savoir fourni)";
}

export type Traitement = {
  // formulaire : la personne veut s'inscrire → le formulaire « نحب نسجل » part avec la réponse.
  decision: "pret" | "escalade" | "ignore" | "formulaire";
  draft: string;
  score: number;
  raisons: string;
};

/** Rédige et note, sans rien envoyer ni écrire. Sert au webhook et aux essais. */
export async function preparerReponse(input: { leadId: string; question: string }): Promise<Traitement> {
  const settings = await getWhatsAppSettings();
  if (ROBOT.test(input.question)) {
    return { decision: "ignore", draft: "", score: 0, raisons: "Message automatique d'une autre entreprise : on ne répond pas à un robot." };
  }
  const [ctx, conv, savoir] = await Promise.all([contexteLead(input.leadId), conversation(input.leadId), savoirTexte()]);
  const consignes = settings.aiInstructions?.trim() || "Réponds en derja tunisienne, en tutoyant, court et chaleureux.";

  const system = `Tu es l'assistant WhatsApp de Space Academy, école tunisienne de design UX/UI. Tu réponds aux personnes qui écrivent au numéro de l'école.

Consignes de l'équipe :
${consignes}

Règles :
- Réponds au NOUVEAU MESSAGE, et à lui seul. La conversation sert à comprendre, pas à répondre de nouveau à d'anciennes questions. Une simple salutation (« 3aslema », « عسلامة », « salut ») appelle une salutation chaleureuse et « كيفاش نجم نعاونك ؟ », rien d'autre.
- Réponds dans la langue et l'écriture de la personne (derja en lettres latines si elle écrit ainsi, en arabe si elle écrit en arabe, français sinon). Les mots courants français/anglais restent en lettres latines.
- Appuie-toi UNIQUEMENT sur le SAVOIR, le CONTEXTE et ce que l'école a déjà écrit dans la conversation (un message de campagne qui annonce un code promo, une date, fait foi). N'invente jamais un prix, une date, un lien, un RIB, une promesse.
- Ne redemande JAMAIS une information que le CRM a déjà (nom, téléphone, email, formule choisie) : utilise-la.
- Si l'information manque, dis simplement qu'un conseiller va répondre.
- Court : 1 à 4 phrases, comme sur WhatsApp. Pas de signature.
- sujetArgent = true SEULEMENT pour un transfert d'argent : RIB, virement, preuve ou reçu de paiement, paiement à vérifier, remboursement, différence à payer, facture. Un prix, une formule ou un code promo ne sont PAS un sujet d'argent : réponds-y.
- robot = true si le message est une réponse automatique d'une entreprise, pas une personne.
- intentionInscription = true si la personne veut s'inscrire ou réserver sa place (« نحب نسجل », « كيفاش نقيد », « nheb nsajel »), ou dit oui quand l'école lui proposait de l'inscrire. Le formulaire d'inscription part alors avec ta réponse : écris juste une phrase courte et chaleureuse qui l'invite à le remplir (sans demander nom, téléphone ou email).

SAVOIR :
${savoir}`;

  const c = client();
  const r1 = await c.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(Redaction), effort: "medium" },
    system,
    messages: [
      {
        role: "user",
        content: `CONTEXTE DE LA PERSONNE :\n${ctx}\n\nCONVERSATION (la plus récente en dernier) :\n${conv || "(début de conversation)"}\n\nNOUVEAU MESSAGE À TRAITER :\n${input.question}`,
      },
    ],
  });
  const redaction = r1.parsed_output;
  if (!redaction) return { decision: "escalade", draft: "", score: 0, raisons: "La rédaction n'a rien donné de lisible." };
  if (redaction.robot) return { decision: "ignore", draft: "", score: 0, raisons: "Message automatique d'une autre entreprise." };

  // La note : une lecture indépendante, qui voit la question et ce qui fonde la réponse.
  const r2 = await c.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    output_config: { format: zodOutputFormat(Note), effort: "medium" },
    system: `Tu contrôles la réponse qu'un assistant veut envoyer sur WhatsApp au nom d'une école. Note-la de 0 à 100 :
- 100 = parfaitement juste, entièrement appuyée sur le SAVOIR ou le CONTEXTE, répond vraiment à la question, ton adapté.
- Retire beaucoup si une information (prix, date, lien, promesse) n'est PAS dans le savoir ou le contexte : c'est une invention.
- Retire si elle ne répond pas à ce que la personne demande, ou si elle est trop vague pour l'aider.
- Une réponse honnête « un conseiller va te répondre » ne vaut jamais plus de 60 : elle n'aide pas.
- Ne retire RIEN parce qu'elle n'ajoute pas d'informations non demandées : on juge la réponse au NOUVEAU message. Une salutation qui répond par une salutation et « comment t'aider ? » mérite 95.
- Retire beaucoup si elle répond à une ancienne question au lieu du nouveau message, ou si elle redemande une information que le CRM a déjà.
Donne des raisons courtes, en français, lisibles par l'équipe.

SAVOIR :
${savoir}`,
    messages: [
      {
        role: "user",
        content: `CONTEXTE DE LA PERSONNE :\n${ctx}\n\nCONVERSATION :\n${conv || "(début)"}\n\nMESSAGE DE LA PERSONNE :\n${input.question}\n\nRÉPONSE PROPOSÉE :\n${redaction.reponse}`,
      },
    ],
  });
  const note = r2.parsed_output;
  const score = Math.max(0, Math.min(100, Math.round(note?.score ?? 0)));
  const raisons = note?.raisons?.trim() || "Note illisible.";

  if (redaction.sujetArgent) {
    return { decision: "escalade", draft: redaction.reponse, score, raisons: `Question d'argent : toujours un humain. ${raisons}` };
  }
  // Vouloir s'inscrire n'appelle pas une information risquée, mais un geste :
  // le formulaire. Il part quelle que soit la note de la phrase qui l'accompagne.
  if (redaction.intentionInscription) {
    return { decision: "formulaire", draft: redaction.reponse, score, raisons: `Veut s'inscrire : le formulaire « نحب نسجل » part avec la réponse. ${raisons}` };
  }
  return {
    decision: score >= settings.aiThreshold ? "pret" : "escalade",
    draft: redaction.reponse,
    score,
    raisons,
  };
}

/**
 * Point d'entrée du webhook (après la réponse faite à Meta). Ne jette jamais.
 * Mode répétition : enregistre ; pour un numéro de test, envoie comme en automatique.
 */
export async function traiterMessageAssistant(input: {
  leadId: string;
  activityId: string | null;
  question: string;
  numero: string;
}) {
  try {
    const settings = await getWhatsAppSettings();
    if (settings.aiMode === "off") return;
    const q = input.question.trim();
    // Rien à lire : pièces jointes non lisibles, boutons, formulaires remplis.
    if (!q || q.startsWith("[") || q.startsWith("📝")) return;

    const t = await preparerReponse({ leadId: input.leadId, question: q });
    const [ligne] = await db
      .insert(aiReplies)
      .values({
        leadId: input.leadId,
        inboundActivityId: input.activityId,
        question: q,
        draft: t.draft,
        score: t.score,
        decision: t.decision,
        raisons: t.raisons,
      })
      .returning({ id: aiReplies.id });

    const envoyer = settings.aiMode === "auto" || estNumeroDeTest(input.numero);
    if (!envoyer || t.decision === "ignore") return;

    // Il passe la main : l'équipe est prévenue (la cloche mène à la conversation,
    // où sa proposition attend) — sinon « on revient vers toi » resterait sans suite.
    if (t.decision === "escalade") {
      const { createNotification } = await import("@/lib/queries");
      const fiche = await db.query.leads.findFirst({ where: eq(leads.id, input.leadId), columns: { fullName: true } });
      await createNotification({
        type: "assistant_escalade",
        message: `L'assistant passe la main — ${fiche?.fullName ?? "un lead"} : « ${q.slice(0, 80)} »`,
        referenceType: "lead",
        referenceId: input.leadId,
      });
    }

    let texte: string;
    let envoi: { ok: boolean; error?: string; sid?: string };
    if (t.decision === "formulaire") {
      const { donneesFlowInscription, FLOW_INSCRIPTION_ID } = await import("@/lib/whatsapp-flow");
      const f = await donneesFlowInscription(input.leadId);
      texte = t.draft || "باهي 🙌 عمّر الفورمولار هذا باش نكملو التسجيل متاعك 👇";
      const { sendWhatsAppFlow } = await import("@/lib/messaging/whatsapp");
      envoi = await sendWhatsAppFlow({ to: input.numero, body: texte, flowId: FLOW_INSCRIPTION_ID, token: f.token, data: f.data });
    } else {
      texte = t.decision === "pret" ? t.draft : MESSAGE_ATTENTE;
      envoi = await sendWhatsApp({ to: input.numero, body: texte });
    }
    if (!envoi.ok) {
      console.error("Assistant WhatsApp — envoi échoué :", envoi.error);
      return;
    }
    const { createActivity } = await import("@/lib/queries");
    const { recordWhatsAppSent } = await import("@/lib/whatsapp-inbox");
    const activite = await createActivity({
      referenceType: "lead",
      referenceId: input.leadId,
      type: "whatsapp",
      direction: "outbound",
      subject:
        t.decision === "pret"
          ? `Réponse de l'assistant (note ${t.score} %)`
          : t.decision === "formulaire"
            ? "Assistant : formulaire « نحب نسجل » envoyé"
            : "Assistant : « on revient vers toi » (passe la main)",
      content: texte,
      createdBy: "assistant",
    });
    if (envoi.sid) await recordWhatsAppSent(envoi.sid, activite.id);
    await db.update(aiReplies).set({ sentText: texte, sentWamid: envoi.sid ?? null }).where(eq(aiReplies.id, ligne.id));
    await db.update(leads).set({ lastContactedAt: new Date() }).where(eq(leads.id, input.leadId));
  } catch (e) {
    console.error("Assistant WhatsApp :", e);
  }
}

/**
 * La proposition de l'assistant qui attend un humain, pour la conversation
 * ouverte dans la page Messages : la plus récente des dernières 24 h, pas
 * encore traitée par l'équipe. Une réponse déjà partie seule n'y figure pas,
 * sauf quand il a passé la main (« on revient vers toi » est parti, pas la réponse).
 */
export async function propositionEnAttente(leadId: string) {
  const [p] = await db.execute<{ id: string; draft: string; score: number; decision: string; raisons: string }>(sql`
    select r.id, r.draft, r.score, r.decision, r.raisons
    from ai_replies r
    where r.lead_id = ${leadId}
      and r.created_at > now() - interval '24 hours'
      and r.decision in ('pret', 'escalade', 'formulaire')
      and r.human_reply is null
      and (r.sent_text is null or r.decision = 'escalade')
      and r.draft <> ''
    order by r.created_at desc limit 1`);
  return p ?? null;
}

/** Ce que l'équipe a répondu à la place de l'assistant : la matière de sa mémoire (étape 4). */
export async function noterReponseHumaine(leadId: string, texte: string) {
  await db.execute(sql`
    update ai_replies set human_reply = ${texte}
    where id = (select id from ai_replies where lead_id = ${leadId} and human_reply is null
                  and decision in ('pret', 'escalade', 'formulaire') and created_at > now() - interval '24 hours'
                order by created_at desc limit 1)`);
}

