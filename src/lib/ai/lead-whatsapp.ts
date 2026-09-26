import "server-only";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Ce que la lecture IA sait du fil WhatsApp d'une personne.
 *
 * Une conversation WhatsApp, c'est un NUMÉRO, pas une fiche (cf.
 * src/lib/whatsapp-inbox.ts) : la même personne a souvent plusieurs fiches —
 * une par formation, ou reportée d'une session à l'autre. Lire les seuls
 * messages de la fiche ouverte, c'était lire la moitié de la conversation.
 */

export type MessageWhatsApp = {
  at: Date;
  direction: "inbound" | "outbound";
  content: string;
  by: string | null;
  /** sent | delivered | read | failed | received — null avant les accusés (0132). */
  status: string | null;
  /** La formation de la fiche qui porte ce message, quand ce n'est pas celle lue. */
  autreFiche: string | null;
};

export type SignalWhatsApp = {
  sens: "chaud" | "froid" | "frein";
  label: string;
};

/** Au-delà, le plus ancien ne pèse plus rien dans la décision — et DOSSIER_MAX coupe de toute façon. */
const FIL_MAX = 200;

/**
 * Tout le fil du numéro (toutes ses fiches) + ce que l'assistant WhatsApp en a
 * retenu, en UNE requête. La clé du numéro est EXACTEMENT celle de
 * whatsapp-inbox.ts (8 derniers chiffres) : c'est elle que sert l'index
 * leads_phone_key_idx (0148).
 *
 * Les dates sortent en millisecondes : un `timestamp` sans fuseau glissé dans
 * du JSON arrive sans « Z », et `new Date()` le lirait en heure LOCALE (1 h
 * d'écart sur le Mac). Le JSON, lui, est nécessaire : `fetch_types: false`
 * rendrait un tableau SQL en texte.
 */
export async function getFilWhatsApp(leadId: string): Promise<{
  messages: MessageWhatsApp[];
  assistant: { decision: string; raisons: string }[];
}> {
  const [r] = await db.execute<{
    fil: { ms: number; direction: "inbound" | "outbound"; content: string | null; by: string | null; status: string | null; lead_id: string; formation: string | null }[] | null;
    ia: { decision: string; raisons: string }[] | null;
  }>(sql`
    with cle as (
      select right(regexp_replace(coalesce(mobile_no, ''), '\D', '', 'g'), 8) as k
      from leads where id = ${leadId}
    ),
    fiches as (
      select l.id, b.name as formation
      from leads l
      left join bootcamps b on b.id = l.bootcamp_id
      where l.id = ${leadId}
         or ((select length(k) from cle) = 8
             and right(regexp_replace(coalesce(l.mobile_no, ''), '\D', '', 'g'), 8) = (select k from cle))
    )
    select
      (select json_agg(m order by m.ms desc) from (
         select (extract(epoch from a.created_at) * 1000)::bigint as ms,
                a.direction::text as direction,
                left(a.content, 600) as content,
                a.created_by as by,
                (select wm.status from whatsapp_messages wm where wm.activity_id = a.id limit 1) as status,
                a.reference_id as lead_id,
                f.formation
         from activities a
         join fiches f on f.id = a.reference_id
         where a.reference_type = 'lead' and a.type = 'whatsapp'
         order by a.created_at desc
         limit ${FIL_MAX}
      ) m) as fil,
      (select json_agg(x) from (
         select r.decision, left(r.raisons, 120) as raisons
         from ai_replies r
         where r.lead_id in (select id from fiches)
         order by r.created_at desc
         limit 30
      ) x) as ia
  `);

  return {
    messages: (r?.fil ?? []).map((m) => ({
      at: new Date(Number(m.ms)),
      direction: m.direction,
      content: (m.content ?? "").replace(/\s+/g, " ").trim(),
      by: m.by,
      status: m.status,
      autreFiche: m.lead_id === leadId ? null : (m.formation ?? "autre fiche"),
    })),
    assistant: r?.ia ?? [],
  };
}

// ── Les signaux ─────────────────────────────────────────
//
// Des FAITS calculés, pas une impression : le modèle les reçoit en plus du
// texte, et l'écran les montre tels quels. Les motifs couvrent le français, le
// derija en lettres arabes et le derija en lettres latines — c'est ce que les
// gens écrivent réellement (mesuré sur les 137 messages reçus au 26/09).

const PRIX_DATE_INSCRIPTION = [
  // argent
  /prix|tarif|co[uû]t|combien|payer|paiement|facilit|tranche|versement|\brib\b|virement|\bdt\b|dinars?/i,
  // Ni « خلاص » (« d'accord ») ni « ريب » seul (« قريب » = bientôt).
  /قداش|سوم|نخلص|الريب|بالتقسيط|تقسيط/,
  // « 9adech », « qadach », « bkadeh » (بقداش)…
  /\bb?[9qk]ad[ae]?c?h\b|\bsoum\b|nkhal[l]?es|nekhles|code promo/i,
  // date, inscription
  /inscri|r[ée]serv|quand (est-ce que )?(ça|ca|la formation)? ?(commence|d[ée]marre)|date de d[ée]but/i,
  /نسجل|تسجيل|التسجيل|بلاصتي|بلاصة|وقتاش|تاريخ|يبدا|تبدا|تبدى|كود برومو/,
  /nsaj[j]?el|tasjil|blasti|wa9tech|waqtech/i,
];

const FORMULAIRE = "📝 Formulaire « نحب نسجل » rempli";

// « مانيش نخدم » contient « نخدم » : la négation doit être écartée AVANT.
// « نحب نخدم » (« je veux travailler ») aussi : c'est un projet, pas un emploi.
const NE_TRAVAILLE_PAS = /نحب نخدم|nheb n[e]?khdem|مانيش نخدم|منيش نخدم|ما نخدمش|مانخدمش|manich n[e]?khdem|mani[s]?h nakhdem|je ne travaille pas|sans emploi|ch[oô]meu/i;
const TRAVAILLE = /نخدم|je travaille|salari[ée]|en poste|n[e]?khdem|nakhdem/i;

const PAS_INTERESSE = /ما يهمنيش|مايهمنيش|ma yhemnich|mayhemnich|pas int[ée]ress|^stop$/i;

const FREINS: { re: RegExp; label: string }[] = [
  { re: /trop cher|c'est cher|tr[eè]s cher|pas les moyens|budget|غالي|غالية|ما عنديش (ال)?فلوس|ghali|ma3andich flous/i, label: "Trouve ça cher" },
  { re: /pas le temps|pas de temps|d[ée]bord[ée]|ما عنديش (ال)?وقت|مش فارغ|mch fergh|ma3andich wa9t/i, label: "Dit ne pas avoir le temps" },
  { re: /r[ée]fl[ée]chi|je vais voir|on verra|je reviens vers|نخمم|باش نشوف|نراجع|nkhamem|bech nchouf/i, label: "Veut réfléchir" },
];

/** Un extrait court et lisible pour servir de preuve. */
const citer = (t: string) => `« ${t.length > 70 ? `${t.slice(0, 70)}…` : t} »`;

const quandCourt = (d: Date) =>
  d.toLocaleString("fr-FR", { timeZone: "Africa/Tunis", day: "2-digit", month: "2-digit" });

/**
 * Les signaux d'un fil. Déterministe à partir du fil ET de `now` : seul
 * « sans réponse » dépend de l'heure, et il ne bascule qu'une fois (24 h après
 * le dernier envoi) — une relecture de plus, pas une par passage.
 */
export function signauxWhatsApp(
  fil: { messages: MessageWhatsApp[]; assistant: { decision: string; raisons: string }[] },
  now = new Date()
): SignalWhatsApp[] {
  const out: SignalWhatsApp[] = [];
  const asc = [...fil.messages].sort((a, b) => a.at.getTime() - b.at.getTime());
  const recus = asc.filter((m) => m.direction === "inbound");

  // Le plus récent d'abord : c'est la phrase qui sert de preuve.
  const recusRecents = [...recus].reverse();

  // 🔥 Chaud
  const formulaire = recusRecents.find((m) => m.content.startsWith(FORMULAIRE));
  if (formulaire) out.push({ sens: "chaud", label: `A rempli le formulaire « نحب نسجل » (${quandCourt(formulaire.at)})` });

  // « غالي السوم عليا » parle du prix mais c'est un FREIN, pas une question :
  // un message qui exprime un frein ne compte pas comme signal chaud.
  const question = recusRecents.find(
    (m) =>
      !m.content.startsWith(FORMULAIRE) &&
      PRIX_DATE_INSCRIPTION.some((re) => re.test(m.content)) &&
      !FREINS.some((f) => f.re.test(m.content))
  );
  if (question) out.push({ sens: "chaud", label: `Question prix / paiement / date / inscription : ${citer(question.content)}` });

  const travail = recusRecents.find((m) => TRAVAILLE.test(m.content) && !NE_TRAVAILLE_PAS.test(m.content));
  if (travail) out.push({ sens: "chaud", label: `Dit qu'il travaille (peut payer) : ${citer(travail.content)}` });

  // Répond vite : délai entre NOTRE message et SA réponse qui le suit directement.
  const delais: number[] = [];
  // Écrit de lui-même : premier message du fil, ou plus de 24 h après le nôtre.
  let spontanes = 0;
  for (let i = 0; i < asc.length; i++) {
    const m = asc[i];
    if (m.direction !== "inbound") continue;
    const avant = asc[i - 1];
    if (!avant) { spontanes++; continue; }
    if (avant.direction === "outbound") {
      const d = m.at.getTime() - avant.at.getTime();
      if (d > 24 * 3_600_000) spontanes++;
      else delais.push(d);
    }
  }
  if (delais.length) {
    const median = [...delais].sort((a, b) => a - b)[Math.floor(delais.length / 2)];
    if (median <= 30 * 60_000) {
      out.push({ sens: "chaud", label: `Répond vite (${Math.max(1, Math.round(median / 60_000))} min en médiane)` });
    }
  }
  if (spontanes) out.push({ sens: "chaud", label: spontanes > 1 ? `Écrit de lui-même (${spontanes} fois)` : "Écrit de lui-même" });

  // ❄️ Froid
  const refus = recusRecents.find((m) => PAS_INTERESSE.test(m.content));
  if (refus) out.push({ sens: "froid", label: `A répondu ${citer(refus.content)}` });

  // Nos messages depuis sa dernière réponse. Un envoi de ce matin n'est pas
  // encore un silence : on attend 24 h avant de le compter.
  const dernierRecu = recus.at(-1)?.at.getTime() ?? 0;
  const depuis = asc.filter((m) => m.direction === "outbound" && m.at.getTime() > dernierRecu && m.status !== "failed");
  const dernierEnvoi = depuis.at(-1);
  if (dernierEnvoi && now.getTime() - dernierEnvoi.at.getTime() > 24 * 3_600_000) {
    const lus = depuis.filter((m) => m.status === "read").length;
    if (lus) {
      out.push({
        sens: "froid",
        label: `${lus > 1 ? `${lus} messages lus` : "Message lu"} sans réponse depuis le ${quandCourt(depuis[0].at)}`,
      });
    } else if (depuis.length >= 2) {
      out.push({ sens: "froid", label: `Silence après ${depuis.length} relances (depuis le ${quandCourt(depuis[0].at)})` });
    }
  }

  // ⚠️ Freins
  for (const f of FREINS) {
    const m = recusRecents.find((x) => f.re.test(x.content));
    if (m) out.push({ sens: "frein", label: `${f.label} : ${citer(m.content)}` });
  }

  // Ce que l'assistant WhatsApp a repéré en traitant ses messages (0152).
  // Les préfixes sont posés par whatsapp-assistant.ts, pas par le modèle.
  if (fil.assistant.some((r) => r.decision === "formulaire" || r.raisons.startsWith("Veut s'inscrire"))) {
    out.push({ sens: "chaud", label: "L'assistant a repéré une intention d'inscription" });
  }
  if (fil.assistant.some((r) => r.raisons.startsWith("Question d'argent"))) {
    out.push({ sens: "chaud", label: "L'assistant a repéré une question d'argent" });
  }

  return out;
}
