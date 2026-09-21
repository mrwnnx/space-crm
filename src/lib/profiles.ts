import "server-only";
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Le profil d'un membre de l'équipe : le nom qu'il s'est donné et sa photo.
 *
 * Rien de nouveau en base : les deux vivent dans `user_metadata` du compte
 * Supabase (`full_name`, `avatar_url`), là où `auth.updateUser()` les écrit.
 * Toutes les attributions du CRM (`created_by`, `received_by`…) portent un
 * email : ce module est la table de correspondance email → nom lisible.
 */
export type TeamProfile = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
};

export async function getTeamProfiles(): Promise<TeamProfile[]> {
  const rows = await db.execute<{
    email: string;
    name: string | null;
    avatar_url: string | null;
  }>(sql`
    select u.email,
           nullif(trim(u.raw_user_meta_data->>'full_name'), '') as name,
           nullif(u.raw_user_meta_data->>'avatar_url', '') as avatar_url
    from auth.users u
    where u.email is not null
  `);
  return rows.map((r) => ({ email: r.email, name: r.name, avatarUrl: r.avatar_url }));
}

// ── Photo de profil ──────────────────────────────────────
// Bucket PUBLIC, à la différence des justificatifs : une photo de profil n'a
// rien de confidentiel et une URL directe se met en cache. Le navigateur a
// déjà réduit l'image à 256 px ; le serveur ne fait que vérifier et ranger.
const BUCKET = "avatars";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type AvatarUpload = { ok: true; url: string } | { ok: false; message: string };

export async function uploadAvatar(userId: string, file: File): Promise<AvatarUpload> {
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "Format accepté : JPG, PNG ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "Photo trop lourde (2 Mo maximum)." };
  }
  const supabase = storage();
  if (!supabase) return { ok: false, message: "Stockage non configuré (clé Supabase absente)." };

  // Un fichier par compte, écrasé à chaque changement : pas d'orphelins à
  // nettoyer. Le `?v=` sur l'URL force le navigateur à recharger la nouvelle
  // image malgré le nom identique.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}.${ext}`;

  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error && /bucket not found/i.test(error.message)) {
    // Premier envoi de l'histoire du CRM : le bucket n'existe pas encore.
    const created = await supabase.storage.createBucket(BUCKET, { public: true });
    if (created.error) return { ok: false, message: created.error.message };
    ({ error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true }));
  }
  if (error) return { ok: false, message: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}
