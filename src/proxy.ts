import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Endpoints machine : pas de session cookie, ils portent leur propre auth.
  // /api/webhook/* → token de form_source ; /api/cron/* → Bearer CRON_SECRET.
  // Sans cette sortie, le cron Vercel reçoit un 307 vers /login et n'importe
  // jamais rien — panne totalement silencieuse.
  if (pathname.startsWith("/api/webhook") || pathname.startsWith("/api/cron")) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options as never);
          });
        },
      },
    }
  );

  // Borne l'appel auth : si Supabase stalle, on n'attend pas le timeout Vercel (300s).
  // Timeout/erreur → user=null → traité comme non authentifié (redirige /login, le cas sûr).
  const user = await Promise.race([
    supabase.auth
      .getUser()
      .then(({ data }) => data.user)
      .catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]);

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/leads";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map)$).*)",
  ],
};
