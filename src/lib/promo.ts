import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { leads, promoCodes } from "@/db/schema";

/*
 * Les codes promo du CRM (26/09). Un lead tape son code comme il veut
 * (« SPACE 20 », « space-20 », « spaec20 », « WAJAHNI » pour WAJAHNI20) : on le
 * rapproche du vrai code, on garde le texte tapé, et on sait enfin ce que
 * chaque code rapporte.
 */

export type CodePromo = typeof promoCodes.$inferSelect;

/** « space-20 » → « SPACE20 » : la forme sous laquelle un code est enregistré et comparé. */
export function normaliserCode(brut: string | null | undefined) {
  return String(brut ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // Deux lettres inversées (« SPAEC20 ») comptent pour une seule faute.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/**
 * Le code que la personne voulait taper, parmi les codes connus. Tolère une
 * faute (deux pour un code long) et un chiffre oublié (« WAJAHNI » → WAJAHNI20) ;
 * trop court ou trop loin : aucun, plutôt qu'un mauvais code.
 */
export function rapprocher(saisi: string | null | undefined, codes: Pick<CodePromo, "id" | "code">[]) {
  const s = normaliserCode(saisi);
  if (s.length < 3) return null;
  const exact = codes.find((c) => c.code === s);
  if (exact) return exact;
  // Le chiffre, c'est la remise : « Space25 » n'est pas SPACE20 (audit 26/09).
  // Seules les lettres tolèrent une faute ; des chiffres tapés doivent être exacts.
  const chiffresSaisis = s.match(/\d+$/)?.[0] ?? "";
  let meilleur: { c: (typeof codes)[number]; d: number } | null = null;
  for (const c of codes) {
    if (chiffresSaisis && (c.code.match(/\d+$/)?.[0] ?? "") !== chiffresSaisis) continue;
    const tol = c.code.length >= 8 ? 2 : 1;
    let d = distance(s, c.code);
    // Le préfixe exact d'un code, sans ses chiffres (« WAJAHNI » pour WAJAHNI20).
    if (s.length >= 5 && c.code.startsWith(s) && /^\d+$/.test(c.code.slice(s.length))) d = Math.min(d, 1);
    if (d <= tol && (!meilleur || d < meilleur.d)) meilleur = { c, d };
  }
  return meilleur?.c ?? null;
}

export async function listerCodes() {
  return db.query.promoCodes.findMany({ orderBy: [desc(promoCodes.createdAt)] });
}

/** Un code utilisable aujourd'hui pour cette formation. */
export function codeValable(c: CodePromo, bootcampId: string | null, jour = new Date()) {
  if (!c.actif) return false;
  const iso = jour.toISOString().slice(0, 10);
  if (c.validFrom && iso < c.validFrom) return false;
  if (c.validUntil && iso > c.validUntil) return false;
  const pour = (c.bootcampIds as string[]) ?? [];
  return pour.length === 0 || (!!bootcampId && pour.includes(bootcampId));
}

/**
 * Les prix d'une formation avec un code : la remise « total » sur le paiement
 * en une fois, la remise « facilité » sur chaque mensualité — absente, le code
 * ne vaut pas pour le paiement en plusieurs fois.
 */
export function prixAvecCode(
  b: { priceTotal: string | null; monthlyCount: number | null; monthlyAmount: string | null },
  c: Pick<CodePromo, "remiseTotalPct" | "remiseFacilitePct">
) {
  const t = c.remiseTotalPct != null ? Number(c.remiseTotalPct) : null;
  const f = c.remiseFacilitePct != null ? Number(c.remiseFacilitePct) : null;
  return {
    total: b.priceTotal && t != null ? Math.round(Number(b.priceTotal) * (1 - t / 100)) : null,
    mensualite: b.monthlyAmount && b.monthlyCount && f != null ? Math.round(Number(b.monthlyAmount) * (1 - f / 100)) : null,
  };
}

/** L'id du code reconnu dans un texte tapé, à poser à côté du texte sur la fiche. */
export async function idDuCode(saisi: string | null | undefined) {
  if (!normaliserCode(saisi)) return null;
  const codes = await db.query.promoCodes.findMany({ columns: { id: true, code: true } });
  return rapprocher(saisi, codes)?.id ?? null;
}

/** Relie une fiche au code qu'elle a tapé (ou la détache s'il n'en reconnaît aucun). */
export async function rattacherLead(leadId: string) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId), columns: { promoCode: true } });
  const codes = await db.query.promoCodes.findMany({ columns: { id: true, code: true } });
  const c = rapprocher(lead?.promoCode, codes);
  await db.update(leads).set({ promoCodeId: c?.id ?? null }).where(eq(leads.id, leadId));
  return c;
}

/**
 * Après la création ou la modification d'un code : les fiches dont le texte
 * tapé correspond sont rattachées (y compris l'historique déjà en base).
 * Un seul passage, sur les textes distincts : quelques centaines, pas 10 000 fiches.
 */
export async function rattacherTout() {
  const codes = await db.query.promoCodes.findMany({ columns: { id: true, code: true } });
  const saisis = await db.execute<{ brut: string }>(sql`
    select distinct promo_code as brut from leads where coalesce(trim(promo_code), '') <> ''`);
  if (saisis.length === 0) return 0;
  // Un seul UPDATE pour tous les textes : une requête par texte coûtait ~12 s.
  const paires = saisis.map(({ brut }) => sql`(${brut}::text, ${rapprocher(brut, codes)?.id ?? null}::uuid)`);
  const r = await db.execute<{ id: string }>(sql`
    update leads l set promo_code_id = v.code_id
    from (values ${sql.join(paires, sql`, `)}) as v(brut, code_id)
    where l.promo_code = v.brut and l.promo_code_id is distinct from v.code_id
    returning l.id`);
  return r.length;
}

/** Par code : leads, inscrits, argent encaissé. Et les codes tapés que rien ne reconnaît. */
export async function statsCodes() {
  const parCode = await db.execute<{ id: string; leads: number; inscrits: number; encaisse: string | null }>(sql`
    select p.id,
      count(l.id)::int as leads,
      count(l.id) filter (where s.kind = 'converted')::int as inscrits,
      (select sum(ps.amount) from payment_schedules ps join leads x on x.id = ps.lead_id
        where x.promo_code_id = p.id and ps.is_paid)::text as encaisse
    from promo_codes p
    left join leads l on l.promo_code_id = p.id
    left join lead_statuses s on s.id = l.status_id
    group by p.id`);
  const inconnus = await db.execute<{ brut: string; leads: number; inscrits: number }>(sql`
    select upper(trim(l.promo_code)) as brut, count(*)::int as leads, count(*) filter (where s.kind = 'converted')::int as inscrits
    from leads l left join lead_statuses s on s.id = l.status_id
    where coalesce(trim(l.promo_code), '') <> '' and l.promo_code_id is null
    group by 1 order by 2 desc limit 30`);
  return { parCode: [...parCode], inconnus: [...inconnus] };
}

/**
 * Le code reconnu sur une fiche, et ce qu'il donne pour SA formation : prix en
 * une fois, mensualité, ou la raison pour laquelle il ne vaut pas (expiré…).
 */
export async function codeDuLead(leadId: string) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { promoCodeId: true, bootcampId: true },
    with: { bootcamp: { columns: { priceTotal: true, monthlyCount: true, monthlyAmount: true } } },
  });
  if (!lead?.promoCodeId) return null;
  const c = await db.query.promoCodes.findFirst({ where: eq(promoCodes.id, lead.promoCodeId) });
  if (!c) return null;
  const valable = codeValable(c, lead.bootcampId);
  const prix = lead.bootcamp ? prixAvecCode(lead.bootcamp, c) : { total: null, mensualite: null };
  return {
    code: c.code,
    valable,
    remiseTotalPct: c.remiseTotalPct != null ? Number(c.remiseTotalPct) : null,
    remiseFacilitePct: c.remiseFacilitePct != null ? Number(c.remiseFacilitePct) : null,
    ...(valable ? prix : { total: null, mensualite: null }),
  };
}

export type CodeDuLead = NonNullable<Awaited<ReturnType<typeof codeDuLead>>>;

// ── Pour l'assistant WhatsApp (brique 3) ─────────────────

const MOT_CODE = /(code|cod\b|كود|كوبون|coupon|promo|برومو)/i;

/**
 * Les codes que la personne cite dans son message. Un mot n'est candidat que
 * s'il porte un chiffre, ou si le message parle de code : sinon « space
 * academy » deviendrait SPACE20.
 */
export function codesCites(message: string, codes: CodePromo[]) {
  const parleDeCode = MOT_CODE.test(message);
  const mots = message.split(/[\s,.;:!?؟،()«»"']+/).filter(Boolean);
  const candidats = [...mots, ...mots.slice(1).map((m, i) => mots[i] + m)];
  const trouves = new Map<string, CodePromo>();
  for (const m of candidats) {
    const n = normaliserCode(m);
    if (n.length < 4 || (!parleDeCode && !/\d/.test(n)) || (/^\d+$/.test(n) && !codes.some((c) => c.code === n))) continue;
    const c = rapprocher(m, codes);
    if (c) trouves.set(c.id, codes.find((x) => x.id === c.id)!);
  }
  return [...trouves.values()];
}

function lignePrix(
  c: CodePromo,
  b: { name: string; priceTotal: string | null; monthlyCount: number | null; monthlyAmount: string | null; currency: string | null },
  bootcampId: string
) {
  const devise = b.currency ?? "TND";
  if (!c.actif) return `${c.code} : désactivé, il ne vaut plus.`;
  if (!codeValable(c, bootcampId)) {
    const fin = c.validUntil && c.validUntil < new Date().toISOString().slice(0, 10);
    return `${c.code} : ${fin ? `expiré depuis le ${c.validUntil}` : `ne vaut pas pour ${b.name}`}.`;
  }
  const p = prixAvecCode(b, c);
  return [
    `${c.code} (${b.name}) :`,
    p.total != null ? `en une fois ${p.total} ${devise} au lieu de ${Number(b.priceTotal)} (−${Number(c.remiseTotalPct)} %)` : "ne vaut PAS pour le paiement en une fois",
    p.mensualite != null
      ? `; en facilité ${b.monthlyCount} × ${p.mensualite} ${devise} au lieu de ${b.monthlyCount} × ${Number(b.monthlyAmount)} (−${Number(c.remiseFacilitePct)} %)`
      : "; ne vaut PAS pour le paiement en plusieurs fois",
    c.validUntil ? `; valable jusqu'au ${c.validUntil}` : "",
  ].join(" ");
}

/**
 * Ce que l'assistant sait des codes pour CE message : les codes cités (prix
 * exacts ou raison du refus), celui de la fiche, et au plus un code qu'il peut
 * proposer — s'il ne l'a jamais donné à ce numéro.
 */
export async function codesPourAssistant(leadId: string, message: string, dejaEcrit: string) {
  const codes = await db.query.promoCodes.findMany();
  if (codes.length === 0) return { texte: "", cites: [] as CodePromo[] };
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
    columns: { promoCodeId: true, bootcampId: true },
    with: { bootcamp: true },
  });
  // Les prix d'une session terminée ne servent à rien : on prend celle où l'on s'inscrit.
  let b = lead?.bootcamp && !["completed", "cancelled"].includes(lead.bootcamp.status) ? lead.bootcamp : null;
  if (!b) {
    const { formationActive } = await import("@/lib/whatsapp-flow");
    const a = await formationActive();
    b = a ? ((await db.query.bootcamps.findFirst({ where: (t, { eq }) => eq(t.id, a.id) })) ?? null) : null;
  }
  if (!b) return { texte: "", cites: [] as CodePromo[] };

  const cites = codesCites(message, codes);
  const sien = codes.find((c) => c.id === lead?.promoCodeId && !cites.some((x) => x.id === c.id));
  const ecrit = dejaEcrit.toUpperCase();
  const proposable = codes.find(
    (c) => c.assistantPeutProposer && codeValable(c, b.id) && !ecrit.includes(c.code) && c.id !== lead?.promoCodeId
  );
  // Un code que l'école a déjà envoyé à ce numéro (modèle « formation complète ») fait foi.
  const annonces = codes.filter((c) => ecrit.includes(c.code) && !cites.some((x) => x.id === c.id) && c.id !== sien?.id);
  const lignes = [
    annonces.length ? `Codes déjà annoncés à cette personne par l'école (tu peux t'y référer) :\n${annonces.map((c) => `- ${lignePrix(c, b, b.id)}`).join("\n")}` : "",
    cites.length ? `Codes cités dans le NOUVEAU message (déjà reconnus, fautes de frappe comprises) :\n${cites.map((c) => `- ${lignePrix(c, b, b.id)}`).join("\n")}` : "",
    sien ? `Code déjà noté sur sa fiche : ${lignePrix(sien, b, b.id)}` : "",
    proposable
      ? `Code que tu PEUX proposer, une seule fois, UNIQUEMENT si la personne trouve le prix trop cher ou hésite à cause du prix : ${lignePrix(proposable, b, b.id)}`
      : "Aucun code à proposer de toi-même : n'en invente jamais un.",
  ];
  return { texte: lignes.filter(Boolean).join("\n"), cites };
}
