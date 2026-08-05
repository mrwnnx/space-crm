import "server-only";

// Client minimal pour le site WordPress (thespace.academy).
// Sert à vérifier que les credentials saisis dans /settings ouvrent bien
// l'API des soumissions Elementor — la config peut être "remplie" et morte.

export type WpCredentials = {
  siteUrl: string;
  username: string;
  appPassword: string;
};

export type WpTestResult = {
  ok: boolean;
  message: string;
};

function authHeader({ username, appPassword }: WpCredentials) {
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

/** Normalise "thespace.academy/" → "https://thespace.academy" */
export function normalizeSiteUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Teste la connexion sur la route réellement utile : la liste des formulaires
 * Elementor. Un 200 sur /wp/v2/users/me ne prouverait pas qu'on peut lire les
 * soumissions (droits + Elementor Pro actif).
 */
export async function testWpConnection(creds: WpCredentials): Promise<WpTestResult> {
  const url = `${creds.siteUrl}/wp-json/elementor/v1/forms`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: authHeader(creds), Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Site injoignable : ${reason}` };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      message: `HTTP ${res.status} — identifiants refusés (vérifie le nom d'utilisateur et l'Application Password).`,
    };
  }
  if (res.status === 404) {
    return {
      ok: false,
      message: "HTTP 404 — route Elementor absente (Elementor Pro inactif sur ce site ?).",
    };
  }
  if (!res.ok) {
    return { ok: false, message: `HTTP ${res.status}` };
  }

  try {
    const json = await res.json();
    const count = Array.isArray(json?.data) ? json.data.length : 0;
    return { ok: true, message: `Connexion OK — ${count} formulaire(s) Elementor accessibles.` };
  } catch {
    return { ok: false, message: "Réponse illisible (ce n'est pas du JSON)." };
  }
}
