import type { LinkClickRow } from "@/lib/campaigns/analytics";

/** Raccourci lisible : le domaine s'efface, le chemin porte le sens. */
function pretty(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

export function CampaignLinks({ links }: { links: LinkClickRow[] }) {
  if (links.length === 0) return null;

  const max = Math.max(...links.map((l) => l.clicks));

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {links.map((l) => (
        <li key={l.url} className="px-3 py-2">
          <div className="flex items-baseline gap-3">
            <a
              href={l.url}
              target="_blank"
              rel="noreferrer noopener"
              title={l.url}
              className="min-w-0 flex-1 truncate text-xs text-foreground hover:underline"
            >
              {pretty(l.url)}
            </a>
            <span className="shrink-0 text-xs font-medium text-foreground">
              {l.clicks} clic{l.clicks > 1 ? "s" : ""}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {l.people} personne{l.people > 1 ? "s" : ""}
            </span>
          </div>
          {/* Barre de proportion : comparer d'un coup d'œil quel lien a porté. */}
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-foreground/40"
              style={{ width: `${Math.round((l.clicks / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
