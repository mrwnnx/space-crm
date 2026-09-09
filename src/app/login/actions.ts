"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function login(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=1");
  }
  redirect("/leads");
}

export async function signup(formData: FormData) {
  const rawEmail = String(formData.get("email"));
  const password = String(formData.get("password"));

  // Allowlist : seul un email présent dans allowed_emails peut créer un compte
  const normalized = rawEmail.trim().toLowerCase();
  const [match] = await db
    .select({ id: allowedEmails.id })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, normalized))
    .limit(1);
  if (!match) {
    redirect("/login?error=unauthorized");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email: rawEmail, password });
  if (error) {
    redirect("/login?error=1");
  }
  redirect("/leads");
}

/**
 * « Mot de passe oublié » — le chemin qui manquait.
 *
 * Jusqu'ici, un collaborateur qui perdait son mot de passe n'avait AUCUN
 * recours dans l'application : il fallait passer par le tableau de bord
 * Supabase. C'était le seul vrai reproche à faire à la connexion par mot de
 * passe, et c'est réparé.
 *
 * Le lien renvoie vers /auth/callback, qui ouvre une session de récupération
 * puis dépose la personne sur /reset-password.
 */
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?mode=forgot&error=email_manquant");

  // ── Le cul-de-sac vécu le 2026-09-09 ──
  //
  // Supabase ne réinitialise PAS un mot de passe qui n'existe pas : il répond
  // « ok » et n'envoie rien. Marwen a testé avec `themarwen.tn@gmail.com` —
  // invitée depuis le 28/08, mais sans compte — et a attendu un email qui ne
  // pouvait pas partir. On distingue donc les trois cas.
  //
  // Ça ne dévoile rien de plus que le formulaire d'inscription, qui répond
  // déjà `error=unauthorized` sur une adresse absente de l'allowlist.
  const [invited] = await db
    .select({ id: allowedEmails.id })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);
  // Sans `mode=forgot` : ces deux messages renvoient vers « Créer un compte »,
  // qui n'existe que sur l'écran principal. Un conseil qui désigne un bouton
  // invisible ne vaut rien.
  if (!invited) redirect("/login?error=non_invitee");

  const existing = await db.execute(
    sql`select 1 from auth.users where lower(email) = ${email} limit 1`
  );
  if (existing.length === 0) redirect("/login?error=pas_de_compte");

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001";

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/reset-password`,
  });

  redirect("/login?mode=forgot&sent=1");
}

/** Pose le nouveau mot de passe, depuis la session ouverte par le lien reçu. */
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) redirect("/reset-password?error=court");
  if (password !== confirm) redirect("/reset-password?error=different");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=1");

  redirect("/leads");
}
