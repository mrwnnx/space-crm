import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Le justificatif d'un paiement — reçu de virement, photo d'un reçu, chèque.
 *
 * Bucket **PRIVÉ**, à la différence de `email-assets` : un justificatif de
 * virement porte un RIB et un nom. Rien ici n'est lisible par une URL devinable.
 * L'adresse de lecture se fabrique à la demande, côté serveur, et expire.
 */
const BUCKET = "justificatifs";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/heic", "image/webp", "application/pdf"];

/** Durée de vie d'un lien de lecture. Assez pour ouvrir, trop court pour traîner. */
const URL_TTL_SECONDS = 300;

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type ProofUpload =
  | { ok: true; path: string; name: string }
  | { ok: false; message: string };

export async function uploadPaymentProof(
  leadId: string,
  echeanceId: string,
  file: File
): Promise<ProofUpload> {
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, message: "Format accepté : image (JPG, PNG, HEIC) ou PDF." };
  }
  if (file.size > MAX_BYTES) {
    const mo = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, message: `Fichier trop lourd (${mo} Mo, maximum 10 Mo).` };
  }

  const supabase = client();
  if (!supabase) return { ok: false, message: "Stockage non configuré (clé Supabase absente)." };

  // Un dossier par lead, un fichier par envoi. Le nom d'origine n'entre PAS
  // dans le chemin : il vient de l'extérieur et sert seulement à l'affichage.
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${leadId}/${echeanceId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, message: error.message };

  return { ok: true, path, name: file.name.slice(0, 120) };
}

/** Lien de lecture temporaire. `null` si le fichier a disparu du bucket. */
export async function signedProofUrl(path: string): Promise<string | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, URL_TTL_SECONDS);
  return error ? null : (data?.signedUrl ?? null);
}
