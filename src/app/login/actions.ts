"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001";

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${base}/auth/callback?next=/reset-password`,
  });

  // Réponse IDENTIQUE que le compte existe ou non : l'écran de connexion est
  // public, et distinguer les deux cas donnerait à n'importe qui le moyen de
  // savoir qui fait partie de l'équipe.
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
