import { NextRequest, NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/campaigns/unsubscribe";

// Désabonnement « en un clic » (RFC 8058), ce que Gmail déclenche depuis son
// bouton « Se désabonner » : un POST silencieux vers l'URL de l'en-tête
// List-Unsubscribe, sans ouvrir de page. Avant cette route, l'en-tête pointait
// sur la PAGE : Gmail recevait un 200 et personne n'était désabonné — la
// personne croyait l'être, continuait de recevoir, et finissait par « Spam ».
//
// Aucune question possible ici : la raison est « one_click ».
// Hors du proxy d'authentification (cf. src/proxy.ts) : le jeton fait foi.

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const campaignId = request.nextUrl.searchParams.get("c");
  const ok = await unsubscribeByToken(token, campaignId, "one_click");
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}

/** Un humain qui ouvre l'URL de l'en-tête arrive sur la page normale. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const c = request.nextUrl.searchParams.get("c");
  const url = new URL(`/unsubscribe/${token}${c ? `?c=${c}` : ""}`, request.nextUrl.origin);
  return NextResponse.redirect(url, 302);
}
