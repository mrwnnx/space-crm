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

// ── Lecture des formulaires et soumissions ─────────────

async function wpGet(creds: WpCredentials, path: string) {
  const res = await fetch(`${creds.siteUrl}/wp-json${path}`, {
    headers: { Authorization: authHeader(creds), Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`WP ${path} → HTTP ${res.status}`);
  return res.json();
}

export type ElementorForm = { id: string; label: string };

/** Liste des formulaires ayant au moins une soumission. `id` = "<postId>_<elementId>". */
export async function listElementorForms(creds: WpCredentials): Promise<ElementorForm[]> {
  const json = await wpGet(creds, "/elementor/v1/forms");
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((r: { value: string; label: string }) => ({
    id: String(r.value),
    label: String(r.label),
  }));
}

/** Id de la soumission la plus récente — sert à poser le curseur au moment du lien. */
export async function getLatestSubmissionId(
  creds: WpCredentials,
  formId: string
): Promise<number | null> {
  const json = await wpGet(
    creds,
    `/elementor/v1/form-submissions?form=${encodeURIComponent(formId)}&per_page=1&order_by=id&order=desc`
  );
  const first = Array.isArray(json?.data) ? json.data[0] : null;
  return first ? Number(first.id) : null;
}

export type ElementorSubmission = {
  id: number;
  createdAt: string;
  values: Record<string, string>;
};

/**
 * Soumissions dont l'id est STRICTEMENT supérieur au curseur, les plus anciennes
 * d'abord. On pagine en desc et on s'arrête au curseur : en régime normal une
 * seule page suffit, sans traverser tout l'historique.
 *
 * ⚠️ La collection ne renvoie que le champ principal (l'email) — il faut un GET
 * par soumission pour tous les champs. D'où `maxFetch`, qui borne le travail.
 */
export async function listSubmissionsAfter(
  creds: WpCredentials,
  formId: string,
  afterId: number | null,
  maxFetch = 100
): Promise<ElementorSubmission[]> {
  const cursor = afterId ?? 0;
  const ids: number[] = [];
  const perPage = 50;

  for (let page = 1; page <= 20; page++) {
    const json = await wpGet(
      creds,
      `/elementor/v1/form-submissions?form=${encodeURIComponent(formId)}&per_page=${perPage}&page=${page}&order_by=id&order=desc`
    );
    const rows: { id: number }[] = Array.isArray(json?.data) ? json.data : [];
    if (rows.length === 0) break;

    let reachedCursor = false;
    for (const row of rows) {
      if (Number(row.id) <= cursor) {
        reachedCursor = true;
        break;
      }
      ids.push(Number(row.id));
    }
    if (reachedCursor || rows.length < perPage || ids.length >= maxFetch) break;
  }

  // Plus ancienne → plus récente, pour que le curseur avance de façon monotone.
  const ordered = ids.sort((a, b) => a - b).slice(0, maxFetch);

  const out: ElementorSubmission[] = [];
  for (const id of ordered) {
    const json = await wpGet(creds, `/elementor/v1/form-submissions/${id}`);
    const d = json?.data ?? json;
    const values: Record<string, string> = {};
    for (const v of Array.isArray(d?.values) ? d.values : []) {
      if (v?.key != null) values[String(v.key)] = String(v.value ?? "");
    }
    out.push({ id, createdAt: String(d?.created_at ?? ""), values });
  }
  return out;
}
