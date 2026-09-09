import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Le retour du lien reçu par email : c'est ici que la session s'ouvre.
 *
 * Deux formes de lien sont acceptées, et ce n'est pas du zèle :
 *
 * 1. `?token_hash=…&type=recovery` — vérifié par `verifyOtp`. **Le seul qui
 *    marche d'un appareil à l'autre**, donc le seul qui serve vraiment : on
 *    demande un lien sur son ordinateur et on l'ouvre sur son téléphone.
 *
 * 2. `?code=…` — échangé par `exchangeCodeForSession`. C'est le flux PKCE de
 *    `@supabase/ssr`, et il exige un cookie « code verifier » posé dans le
 *    navigateur QUI A FAIT LA DEMANDE. Ouvrir ce lien ailleurs échoue
 *    forcément. Gardé pour ne pas casser un lien déjà en circulation.
 *
 * ⚠️ Cette URL doit figurer dans Supabase → Authentication → URL Configuration
 * → Redirect URLs, sinon Supabase refuse la redirection et le lien meurt avant
 * d'arriver ici.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/leads";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  // ── 1. Le chemin indépendant de l'appareil.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=lien_expire`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // ── 2. L'ancien chemin, lié au navigateur d'origine.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // Cause la plus fréquente ici : le lien a été ouvert sur un AUTRE
      // appareil que celui qui l'a demandé — le cookie de vérification n'y est
      // pas. Un lien déjà servi ou périmé donne la même erreur, et se règle
      // pareil : en redemander un.
      return NextResponse.redirect(`${origin}/login?error=lien_autre_appareil`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
}
