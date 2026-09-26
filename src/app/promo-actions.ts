"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { promoCodes } from "@/db/schema";
import { normaliserCode, rattacherTout } from "@/lib/promo";

export type CodeSaisi = {
  id?: string;
  code: string;
  label: string;
  source: string;
  remiseTotalPct: string;
  remiseFacilitePct: string;
  validFrom: string;
  validUntil: string;
  bootcampIds: string[];
  assistantPeutProposer: boolean;
  actif: boolean;
};

function pct(v: string) {
  const t = v.trim().replace(",", ".");
  if (!t) return { ok: true as const, v: null };
  const n = Number(t);
  return n > 0 && n < 100 ? { ok: true as const, v: String(n) } : { ok: false as const };
}

/** Crée ou modifie un code, puis rattache les fiches qui l'avaient déjà tapé. */
export async function enregistrerCodeAction(c: CodeSaisi) {
  const user = await requireUser();
  const code = normaliserCode(c.code);
  if (code.length < 3) return { ok: false as const, error: "Le code doit faire au moins 3 caractères (lettres et chiffres)." };
  const total = pct(c.remiseTotalPct);
  const facilite = pct(c.remiseFacilitePct);
  if (!total.ok || !facilite.ok) return { ok: false as const, error: "Une remise est un pourcentage entre 1 et 99." };
  if (total.v == null && facilite.v == null) return { ok: false as const, error: "Indiquez au moins une remise." };
  if (c.validFrom && c.validUntil && c.validUntil < c.validFrom) return { ok: false as const, error: "La date de fin est avant la date de début." };
  const valeurs = {
    code,
    label: c.label.trim(),
    source: c.source.trim(),
    remiseTotalPct: total.v,
    remiseFacilitePct: facilite.v,
    validFrom: c.validFrom || null,
    validUntil: c.validUntil || null,
    bootcampIds: c.bootcampIds,
    assistantPeutProposer: c.assistantPeutProposer,
    actif: c.actif,
    updatedAt: new Date(),
  };
  const deja = await db.query.promoCodes.findFirst({ where: eq(promoCodes.code, code), columns: { id: true } });
  if (deja && deja.id !== c.id) return { ok: false as const, error: `Le code ${code} existe déjà.` };
  if (c.id) await db.update(promoCodes).set(valeurs).where(eq(promoCodes.id, c.id));
  else await db.insert(promoCodes).values({ ...valeurs, createdBy: user.email ?? null });
  const rattaches = await rattacherTout();
  revalidatePath("/settings");
  return { ok: true as const, rattaches };
}

/** Supprimer un code détache ses fiches (le texte tapé, lui, reste). */
export async function supprimerCodeAction(id: string) {
  await requireUser();
  await db.delete(promoCodes).where(eq(promoCodes.id, id));
  revalidatePath("/settings");
  return { ok: true as const };
}
