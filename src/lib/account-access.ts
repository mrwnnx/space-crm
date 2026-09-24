import "server-only";
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Bloquer / rouvrir le compte d'une adresse (audit S4).
 *
 * Retirer quelqu'un de l'équipe n'effaçait que son invitation : son compte
 * gardait son mot de passe et ses connexions ouvertes. On le BANNIT plutôt
 * que de le supprimer : ses notes, appels et paiements portent son adresse,
 * et une réinvitation doit pouvoir le rouvrir tel quel.
 */

// ~100 ans : Supabase n'a pas de « pour toujours ».
const TOUJOURS = "876000h";

function adminAuth() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } }).auth.admin;
}

async function userId(email: string) {
  const rows = await db.execute<{ id: string }>(
    sql`select id from auth.users where lower(email) = ${email.trim().toLowerCase()} limit 1`
  );
  return rows[0]?.id ?? null;
}

/** `null` = fait (ou pas de compte à bloquer) ; sinon, la raison de l'échec. */
export async function setAccountBlocked(email: string, blocked: boolean): Promise<string | null> {
  const id = await userId(email);
  if (!id) return null; // invitée sans compte : rien à bloquer
  const admin = adminAuth();
  if (!admin) return "clé Supabase absente";
  const { error } = await admin.updateUserById(id, { ban_duration: blocked ? TOUJOURS : "none" });
  if (error) return error.message;
  // Le ban refuse les NOUVELLES connexions ; effacer les sessions coupe aussi
  // celles déjà ouvertes (le proxy revérifie chaque page par getUser).
  if (blocked) await db.execute(sql`delete from auth.sessions where user_id = ${id}`);
  return null;
}
