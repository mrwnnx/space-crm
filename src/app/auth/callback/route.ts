import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Le retour du lien magique : c'est ici que la session s'ouvre.
 *
 * Supabase renvoie un `code` à usage unique ; il s'échange contre une session
 * posée en cookie. Sans cette route, le lien reçu par email n'aboutirait nulle
 * part — et c'est le genre de panne qui ne se voit qu'au premier vrai clic.
 *
 * ⚠️ L'URL de cette route doit figurer dans Supabase →
 * Authentication → URL Configuration → Redirect URLs, sinon Supabase refuse la
 * redirection et le lien meurt avant d'arriver ici.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/leads";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=lien_invalide`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Lien déjà utilisé, ou périmé : les deux se disent pareil au visiteur,
    // et se règlent pareil — en redemander un.
    return NextResponse.redirect(`${origin}/login?error=lien_expire`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
