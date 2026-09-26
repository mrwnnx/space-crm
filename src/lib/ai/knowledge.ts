import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiKnowledge } from "@/db/schema";

/*
 * Le savoir de l'assistant WhatsApp : ce qu'on lui donne (texte, fichiers,
 * liens) et ce qu'il apprend (souvenirs, étape 4). Seul du TEXTE est gardé :
 * un PDF est lu une fois, à l'ajout, et c'est son texte qui sert ensuite.
 */

// Au-delà, une source noie les autres dans la réponse : on coupe, et on le dit.
const MAX_CARACTERES = 40_000;

export type Savoir = typeof aiKnowledge.$inferSelect;

export async function listerSavoir() {
  return db.query.aiKnowledge.findMany({ orderBy: [desc(aiKnowledge.createdAt)] });
}

/** Le savoir actif, tel que l'assistant le lira. */
export async function savoirActif() {
  return db.query.aiKnowledge.findMany({
    where: eq(aiKnowledge.status, "actif"),
    orderBy: [desc(aiKnowledge.createdAt)],
  });
}

function couper(texte: string) {
  const t = texte.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return t.length > MAX_CARACTERES ? { texte: t.slice(0, MAX_CARACTERES), coupe: true } : { texte: t, coupe: false };
}

export async function ajouterTexte(titre: string, contenu: string, auteur: string | null) {
  const { texte } = couper(contenu);
  if (!titre.trim() || !texte) return { ok: false as const, error: "Un titre et un texte, s'il vous plaît." };
  await db.insert(aiKnowledge).values({ kind: "texte", title: titre.trim(), content: texte, createdBy: auteur });
  return { ok: true as const };
}

/**
 * Un fichier : texte brut lu tel quel, PDF lu par Claude (il garde la mise
 * en forme utile, les tableaux de prix, et ignore le décor).
 */
export async function ajouterFichier(fichier: File, auteur: string | null) {
  const nom = fichier.name;
  let brut = "";
  if (/\.(txt|md|csv)$/i.test(nom) || fichier.type.startsWith("text/")) {
    brut = await fichier.text();
  } else if (fichier.type === "application/pdf" || /\.pdf$/i.test(nom)) {
    const lu = await lirePdf(Buffer.from(await fichier.arrayBuffer()).toString("base64"));
    if (!lu.ok) return lu;
    brut = lu.texte;
  } else {
    return { ok: false as const, error: "Formats acceptés : PDF, TXT, MD ou CSV." };
  }
  const { texte, coupe } = couper(brut);
  if (!texte) return { ok: false as const, error: "Aucun texte lisible dans ce fichier." };
  await db.insert(aiKnowledge).values({ kind: "fichier", title: nom, content: texte, source: nom, createdBy: auteur });
  return { ok: true as const, coupe };
}

async function lirePdf(base64: string): Promise<{ ok: true; texte: string } | { ok: false; error: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "ANTHROPIC_API_KEY absente" };
  try {
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    const client = new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
    const r = await client.messages
      .stream({
        model: "claude-opus-5",
        max_tokens: 32000,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              {
                type: "text",
                text: "Retranscris le contenu utile de ce document, en texte simple, dans sa langue d'origine : titres, paragraphes, listes, tableaux (une ligne par rangée). Ignore le décor, les numéros de page et les éléments répétés. Réponds seulement par le texte.",
              },
            ],
          },
        ],
      })
      .finalMessage();
    const texte = r.content.map((b) => (b.type === "text" ? b.text : "")).join("\n").trim();
    return texte ? { ok: true, texte } : { ok: false, error: "Le PDF n'a rien donné de lisible." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Lecture du PDF impossible" };
  }
}

/**
 * Un lien : on lit la page une fois et on garde son texte. Seulement du https
 * public — jamais une adresse interne (le serveur irait la chercher).
 */
export async function ajouterLien(adresse: string, auteur: string | null) {
  let url: URL;
  try {
    url = new URL(adresse.trim());
  } catch {
    return { ok: false as const, error: "Adresse invalide." };
  }
  let html = "";
  try {
    // Chaque redirection est revérifiée : une page publique qui renvoie vers une
    // adresse interne ne doit pas faire lire le réseau du serveur (audit 26/09).
    let res: Response | null = null;
    for (let saut = 0; saut < 5; saut++) {
      if (!(await adressePublique(url))) return { ok: false as const, error: "Seulement une page web publique en https." };
      res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; SpaceAcademyCRM)" } });
      const suite = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!suite) break;
      url = new URL(suite, url);
      res = null;
    }
    if (!res) return { ok: false as const, error: "Trop de redirections." };
    if (!res.ok) return { ok: false as const, error: `La page répond ${res.status}.` };
    html = (await res.text()).slice(0, 2_000_000);
  } catch (e) {
    return { ok: false as const, error: `Page injoignable : ${e instanceof Error ? e.message : e}` };
  }
  const titre = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || url.hostname + url.pathname;
  const texte = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]{2,}/g, " ");
  const { texte: propre, coupe } = couper(texte);
  if (propre.length < 50) return { ok: false as const, error: "Presque aucun texte lisible sur cette page." };
  await db.insert(aiKnowledge).values({ kind: "lien", title: titre.replace(/\s+/g, " ").slice(0, 200), content: propre, source: url.toString(), createdBy: auteur });
  return { ok: true as const, coupe };
}

/** https, un vrai nom de domaine, et toutes ses adresses IP publiques. */
async function adressePublique(url: URL) {
  const hote = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (url.protocol !== "https:" || !hote.includes(".") || hote === "localhost") return false;
  const { lookup } = await import("node:dns/promises");
  const { isIP } = await import("node:net");
  const ips = isIP(hote) ? [hote] : (await lookup(hote, { all: true }).catch(() => [])).map((a) => a.address);
  if (ips.length === 0) return false;
  return ips.every((ip) => {
    if (ip.includes(":")) {
      const v = ip.toLowerCase();
      if (v.startsWith("::ffff:")) return ipv4Publique(v.slice(7));
      return !(v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80"));
    }
    return ipv4Publique(ip);
  });
}

function ipv4Publique(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  );
}

export async function changerStatutSavoir(id: string, status: "actif" | "archive") {
  await db.update(aiKnowledge).set({ status, updatedAt: new Date() }).where(eq(aiKnowledge.id, id));
}

export async function supprimerSavoir(id: string) {
  await db.delete(aiKnowledge).where(eq(aiKnowledge.id, id));
}

export async function modifierSavoir(id: string, titre: string, contenu: string) {
  const { texte } = couper(contenu);
  if (!titre.trim() || !texte) return { ok: false as const, error: "Un titre et un texte, s'il vous plaît." };
  await db.update(aiKnowledge).set({ title: titre.trim(), content: texte, updatedAt: new Date() }).where(eq(aiKnowledge.id, id));
  return { ok: true as const };
}

// ── Ce qu'il apprend (étape 4) ─────────────────────────

/**
 * Une remarque de l'équipe sur une réponse : elle devient une RÈGLE, active
 * tout de suite (c'est l'équipe qui parle), et passe avant tout le reste.
 */
export async function ajouterLecon(texte: string, auteur: string | null, contexte?: string | null) {
  const t = texte.trim();
  if (!t) return { ok: false as const, error: "La remarque est vide." };
  await db.insert(aiKnowledge).values({
    kind: "lecon",
    title: t.length > 100 ? `${t.slice(0, 97)}…` : t,
    content: contexte ? `${t}\n\n(À propos du message : « ${contexte.slice(0, 200)} »)` : t,
    status: "actif",
    createdBy: auteur,
  });
  return { ok: true as const };
}

/**
 * L'équipe a répondu elle-même ou a CORRIGÉ la proposition : un souvenir « à
 * valider ». Recopier la proposition telle quelle n'apprend rien : ignoré.
 */
export async function ajouterSouvenir(input: { question: string; humain: string; propose: string; auteur: string | null }) {
  const normal = (x: string) => x.replace(/\s+/g, " ").trim().toLowerCase();
  if (!input.humain.trim() || normal(input.humain) === normal(input.propose)) return;
  await db.insert(aiKnowledge).values({
    kind: "souvenir",
    title: input.question.length > 120 ? `${input.question.slice(0, 117)}…` : input.question,
    content: [
      `Question : ${input.question}`,
      `Réponse de l'équipe : ${input.humain}`,
      input.propose ? `(L'assistant avait proposé : « ${input.propose} » — l'équipe a répondu autrement.)` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    status: "a_valider",
    createdBy: input.auteur,
  });
}

/**
 * « Apprendre notre style » : les dernières réponses écrites À LA MAIN par
 * l'équipe sur WhatsApp → un guide d'écriture, à valider avant usage.
 */
export async function apprendreStyle(auteur: string | null) {
  const exemples = await db.execute<{ content: string }>(sql`
    select a.content from activities a
    where a.type = 'whatsapp' and a.direction = 'outbound' and a.created_by like '%@%'
      and length(coalesce(a.content, '')) between 15 and 1200
    order by a.created_at desc limit 80`);
  if (exemples.length < 5) return { ok: false as const, error: "Pas assez de réponses écrites par l'équipe pour en tirer un style (5 minimum)." };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false as const, error: "ANTHROPIC_API_KEY absente" };
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {});
  const r = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4000,
    output_config: { effort: "medium" },
    messages: [
      {
        role: "user",
        content: `Voici des messages WhatsApp écrits à la main par l'équipe d'une école tunisienne (Space Academy) à des prospects. Rédige, en français, un guide de style court (10 points maximum) pour qu'un assistant écrive EXACTEMENT comme elle : langue et écriture (derja en lettres latines ou arabes, français), tutoiement ou vouvoiement, longueur, salutations et formules de fin, emojis (lesquels, combien), ton, tournures typiques (cite-les), ce qu'elle ne fait jamais. Seulement ce que les exemples montrent. Réponds par le guide seul, sans introduction.\n\nMESSAGES :\n${exemples.map((e) => `- ${e.content.replace(/\s+/g, " ")}`).join("\n")}`,
      },
    ],
  });
  const guide = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!guide) return { ok: false as const, error: "Rien de lisible, réessayez." };
  // Un seul style en attente : le nouveau remplace l'ancien brouillon.
  await db.delete(aiKnowledge).where(and(eq(aiKnowledge.kind, "style"), eq(aiKnowledge.status, "a_valider")));
  await db.insert(aiKnowledge).values({
    kind: "style",
    title: `Notre style (tiré de ${exemples.length} messages de l'équipe)`,
    content: guide,
    status: "a_valider",
    createdBy: auteur,
  });
  return { ok: true as const, n: exemples.length };
}


// ── Banque de questions (26/09) ────────────────────────

/**
 * Une question à laquelle l'assistant n'a pas su répondre : elle attend la
 * réponse de l'équipe dans Paramètres. Une question déjà en attente n'est pas
 * reposée (même texte, à la casse près).
 */
export async function ajouterQuestion(question: string, messageDuLead: string) {
  const q = question.trim().slice(0, 300);
  if (!q) return;
  const [deja] = await db.execute<{ id: string }>(sql`
    select id from ai_knowledge where kind = 'question' and status = 'a_valider' and lower(title) = lower(${q}) limit 1`);
  if (deja) return;
  await db.insert(aiKnowledge).values({
    kind: "question",
    title: q,
    content: `Message du lead : « ${messageDuLead.slice(0, 300)} »`,
    status: "a_valider",
    createdBy: "assistant",
  });
}

/** L'équipe répond : la question devient un savoir actif (question + réponse). */
export async function repondreQuestion(id: string, reponse: string, auteur: string | null) {
  const r = reponse.trim();
  if (!r) return { ok: false as const, error: "La réponse est vide." };
  const [q] = await db.select().from(aiKnowledge).where(and(eq(aiKnowledge.id, id), eq(aiKnowledge.kind, "question")));
  if (!q) return { ok: false as const, error: "Question introuvable." };
  await db
    .update(aiKnowledge)
    .set({ kind: "texte", status: "actif", content: `Question : ${q.title}\nRéponse de l'équipe : ${r}`, createdBy: auteur, updatedAt: new Date() })
    .where(eq(aiKnowledge.id, id));
  return { ok: true as const };
}
