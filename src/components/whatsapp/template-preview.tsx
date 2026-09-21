"use client";

/**
 * L'aperçu du modèle, tel que le lead le lira : chaque {{n}} prend la valeur
 * choisie (exemple pour le prénom, vraie formation pour le reste, texte tel
 * quel pour une valeur fixe) ; un {{n}} encore sans variable reste en évidence.
 */
export function ApercuModele({
  body,
  buttons,
  valeurs,
}: {
  body: string;
  buttons: string[];
  valeurs: string[];
}) {
  const rtl = /[\u0600-\u06FF]/.test(body);
  const parts = body.split(/(\{\{\d+\}\})/g);
  return (
    <div className="mb-4 rounded-lg bg-muted/60 p-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Aperçu
      </p>
      <div
        dir={rtl ? "rtl" : "ltr"}
        className={`max-w-[420px] rounded-xl border border-border bg-background px-3 py-2 text-[14px] leading-relaxed whitespace-pre-wrap ${rtl ? "rounded-tr-sm" : "rounded-tl-sm"}`}
      >
        {parts.map((part, i) => {
          const m = /^\{\{(\d+)\}\}$/.exec(part);
          if (!m) return <span key={i}>{part}</span>;
          const valeur = valeurs[Number(m[1]) - 1];
          return valeur ? (
            <span key={i} className="rounded bg-primary/15 px-0.5 font-medium">
              {valeur}
            </span>
          ) : (
            <span key={i} className="rounded bg-amber-500/20 px-0.5 font-mono text-[12px] text-amber-700 dark:text-amber-500">
              {part}
            </span>
          );
        })}
      </div>
      {buttons.length > 0 && (
        <div dir={rtl ? "rtl" : "ltr"} className="mt-1.5 flex max-w-[420px] flex-col gap-1">
          {buttons.map((b) => (
            <div
              key={b}
              className="rounded-lg border border-border bg-background py-1.5 text-center text-[13px] text-primary"
            >
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
