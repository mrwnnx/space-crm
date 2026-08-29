import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Bucket PUBLIC : un client mail n'a pas de session, l'image doit être lisible
 * sans authentification. Créé une fois côté Supabase (public, 2 Mo, images).
 */
const BUCKET = "email-assets";
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export type UploadResult =
  | { ok: true; url: string; warning?: string }
  | { ok: false; message: string };

export async function uploadEmailImage(file: File): Promise<UploadResult> {
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "Format accepté : PNG, JPG, GIF ou WebP." };
  }
  if (file.size > MAX_BYTES) {
    const mo = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `Image trop lourde (${mo} Mo, maximum 2 Mo).` };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { ok: false, message: "Stockage non configuré (clé Supabase absente)." };
  }

  // Nom unique : deux fichiers « logo.png » ne doivent pas s'écraser, et une
  // image déjà envoyée dans un email ne doit jamais changer sous les pieds
  // du destinataire.
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${crypto.randomUUID()}.${ext}`;

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000" });

  if (error) return { ok: false, message: error.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    ok: true,
    url: data.publicUrl,
    // Pas bloquant — mais un logo en WebP serait un carré vide dans Outlook.
    warning:
      file.type === "image/webp"
        ? "WebP envoyé : Outlook ne l'affiche pas. Préfère un PNG ou un JPG."
        : undefined,
  };
}
