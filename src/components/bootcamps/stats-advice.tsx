"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getStatsAdviceAction } from "@/app/actions";

type Cible = { id: string; name: string | null; phone: string | null; raison: string };
type Conseil = { action: string; pourquoi: string };

/**
 * La pastille ✦ d'un bloc de statistiques.
 *
 * Elle n'existe QUE là où une règle a détecté un écart — sa présence est donc
 * elle-même une information. Sur un chiffre qui va bien, il n'y a rien.
 *
 * Le conseil s'ouvre en FENÊTRE et non sous le bloc : déplié en place, il
 * poussait les cartes voisines et la page se réorganisait sous les yeux.
 *
 * L'appel au modèle part au premier clic seulement — on ne paie pas un conseil
 * pour un écran qu'on fait défiler — et le résultat reste en mémoire tant que
 * la page est ouverte.
 */
export function StatsAdvice({
  bootcampId,
  block,
  title,
  constat,
}: {
  bootcampId: string;
  block: string;
  /** Le nom du bloc, repris en titre de la fenêtre. */
  title: string;
  /** Connu sans le modèle : affiché avant même que le conseil arrive. */
  constat: string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    cibles: Cible[];
    conseils: Conseil[];
    avertissement: string | null;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Échap ferme, comme partout ailleurs dans le CRM.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function ouvrir() {
    setOpen(true);
    if (data || isPending) return;
    startTransition(async () => {
      const res = await getStatsAdviceAction(bootcampId, block);
      if ("error" in res && res.error) return setErreur(res.error);
      if ("ok" in res) {
        setData({
          cibles: res.cibles as Cible[],
          conseils: res.conseils as Conseil[],
          avertissement: res.avertissement ?? null,
        });
      }
    });
  }

  return (
    <>
      <button
        onClick={ouvrir}
        title="Que faire de ce chiffre ?"
        aria-label="Que faire de ce chiffre ?"
        className="grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full bg-primary text-[12px] leading-none text-primary-foreground ring-[3px] ring-primary/15 transition-shadow hover:ring-primary/30"
      >
        ✦
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-mono text-[11.5px] font-semibold uppercase tracking-wider text-primary">
                  {isPending ? "Hani nkhamem…" : "Ce que je ferais"}
                </p>
                <h3 className="mt-0.5 font-heading text-sm font-semibold text-foreground">{title}</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="-mr-1 -mt-0.5 shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <p className="mb-3.5 text-xs font-medium leading-relaxed text-foreground">{constat}</p>

              {erreur && <p className="text-xs text-amber-700 dark:text-amber-500">{erreur}</p>}

              {isPending && !data && (
                <p className="animate-pulse text-xs text-muted-foreground">
                  Je croise les chiffres et je cherche les personnes concernées…
                </p>
              )}

              {data && (
                <>
                  {data.conseils.length > 0 && (
                    <ol className="mb-4 list-decimal space-y-2.5 pl-4 text-xs leading-relaxed text-foreground">
                      {data.conseils.map((c, i) => (
                        <li key={i}>
                          {c.action}
                          {c.pourquoi && (
                            <span className="mt-0.5 block text-[13px] text-muted-foreground">
                              {c.pourquoi}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}

                  {data.avertissement && (
                    <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] leading-relaxed text-amber-700 dark:text-amber-500">
                      {data.avertissement}
                    </p>
                  )}

                  {data.cibles.length > 0 && (
                    <>
                      <p className="mb-1.5 font-mono text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {data.cibles.length} personnes concernées
                      </p>
                      <ul className="overflow-hidden rounded-lg border border-border">
                        {data.cibles.map((c) => (
                          <li key={c.id} className="border-b border-border last:border-0">
                            <Link
                              href={`/leads/${c.id}`}
                              className="flex items-baseline justify-between gap-3 px-3 py-2 hover:bg-muted"
                            >
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                                {c.name ?? "Sans nom"}
                              </span>
                              {c.phone && (
                                <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted-foreground">
                                  {c.phone}
                                </span>
                              )}
                              <span className="shrink-0 text-[12px] text-muted-foreground">
                                {c.raison}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
