"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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

  if (password.length < 8) redirect("/login?error=court");

  // ── Le compte est créé par le serveur, plus par la porte publique ──
  //
  // Audit du 22/09 : `supabase.auth.signUp` passait par l'inscription publique
  // de Supabase, que n'importe qui pouvait appeler directement avec la clé
  // anon — l'allowlist ci-dessus ne protégeait que ce formulaire. Cette porte
  // est désormais FERMÉE (Auth → « Allow new users to sign up » décoché) ;
  // l'API admin, elle, reste ouverte au serveur seul.
  //
  // La confirmation par email est gardée : le lien prouve que la personne
  // possède la boîte. Sans lui, qui connaît l'adresse d'un invité pourrait
  // créer le compte à sa place.
  const admin = adminAuth();
  if (!admin) redirect("/login?error=1");

  const [existing] = await db.execute<{ id: string; confirmed: boolean }>(
    sql`select id, email_confirmed_at is not null as confirmed from auth.users where lower(email) = ${normalized} limit 1`
  );
  if (existing?.confirmed) redirect("/login?error=deja_compte");

  let tokenHash: string | undefined;
  let type: "signup" | "magiclink";
  if (existing) {
    // Compte créé mais jamais confirmé (lien expiré) : on repose le mot de
    // passe choisi et on renvoie un lien — un lien magique confirme aussi l'email.
    await admin.updateUserById(existing.id, { password });
    const { data, error } = await admin.generateLink({ type: "magiclink", email: normalized });
    if (error) redirect("/login?error=1");
    tokenHash = data.properties?.hashed_token;
    type = "magiclink";
  } else {
    const { data, error } = await admin.generateLink({ type: "signup", email: normalized, password });
    if (error) redirect("/login?error=1");
    tokenHash = data.properties?.hashed_token;
    type = "signup";
  }
  if (!tokenHash) redirect("/login?error=1");

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001";
  const { sendSignupConfirmEmail } = await import("@/lib/messaging/invite");
  const sent = await sendSignupConfirmEmail(
    normalized,
    `${base}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&next=/leads`
  );
  if (!sent.ok) redirect("/login?error=1");

  redirect("/login?sent=inscription");
}

/** Client Supabase avec la clé service : réservé au serveur, jamais importé côté client. */
function adminAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key, { auth: { persistSession: false } }).auth.admin;
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
