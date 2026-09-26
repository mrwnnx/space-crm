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
  let meilleur: { c: (typeof codes)[number]; d: number } | null = null;
  for (const c of codes) {
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
