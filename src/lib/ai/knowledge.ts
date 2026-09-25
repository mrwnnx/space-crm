import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { desc, eq } from "drizzle-orm";
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
  const hote = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(hote) || !hote.includes(".")) {
    return { ok: false as const, error: "Seulement une page web publique en https." };
  }
  let html = "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; SpaceAcademyCRM)" } });
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

export async function changerStatutSavoir(id: string, status: "actif" | "archive") {
  await db.update(aiKnowledge).set({ status, updatedAt: new Date() }).where(eq(aiKnowledge.id, id));
}

export async function supprimerSavoir(id: string) {
  await db.delete(aiKnowledge).where(eq(aiKnowledge.id, id));
}
