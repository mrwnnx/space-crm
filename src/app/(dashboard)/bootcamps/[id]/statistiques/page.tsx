import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { getBootcampById, getFormationStats } from "@/lib/queries";
import { detectGaps, gapFor, type Gap, type GapBlock } from "@/lib/stats-gaps";
import { StatsAdvice } from "@/components/bootcamps/stats-advice";
import { actorName } from "@/lib/actors";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Les statistiques d'UNE formation, sur toute sa vie.
 *
 * Pas de sélecteur de période : une formation a un début et une fin, elle EST
 * la période. Seul le rythme garde une fenêtre de 7 jours — un histogramme en a
 * besoin, ce n'est pas un filtre sur la page.
 *
 * La comparaison ENTRE sessions vit dans /analytics. Une même question à deux
 * endroits finit toujours par donner deux réponses différentes.
 */

const METHOD_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
};

function Card({
  title,
  sub,
  children,
  verdict,
  gap,
  bootcampId,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  /** Lecture informative, sans écart à corriger (« Les gens »). */
  verdict?: React.ReactNode;
  /** L'écart détecté par la règle. Sa présence fait apparaître la pastille ✦. */
  gap?: Gap;
  bootcampId?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
        {title}
        {gap && bootcampId && (
          <StatsAdvice
            bootcampId={bootcampId}
            block={gap.block}
            title={title}
            constat={gap.constat}
          />
        )}
      </h2>
      {sub && <p className="mt-0.5 mb-3 text-[11px] text-muted-foreground">{sub}</p>}
      {children}
      {gap && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-500">
          {gap.constat}
        </p>
      )}
      {!gap && verdict && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {verdict}
        </p>
      )}
    </div>
  );
}

/** Une ligne « libellé — barre — valeur ». */
function Row({
  label,
  hint,
  pct,
  value,
  tone = "normal",
}: {
  label: string;
  hint?: string;
  pct: number;
  value: string;
  tone?: "normal" | "soft" | "alert" | "good";
}) {
  const fill =
    tone === "alert" ? "bg-amber-600" : tone === "good" ? "bg-emerald-600"
      : tone === "soft" ? "bg-primary/25" : "bg-primary";
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr_3rem] items-center gap-2 text-[11.5px]">
      <span className={`truncate ${tone === "alert" ? "font-medium text-amber-700 dark:text-amber-500" : "text-muted-foreground"}`}>
        {label}
        {hint && <span className="ml-1 font-mono text-[9.5px] opacity-70">{hint}</span>}
      </span>
      <span className="h-3.5 overflow-hidden rounded bg-muted">
        <span className={`block h-full rounded ${fill}`} style={{ width: `${Math.max(pct, 0)}%` }} />
      </span>
      <span className="text-right font-mono text-[11.5px] font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Big({ value, unit, label, tone }: { value: string; unit?: string; label: string; tone?: "good" | "alert" }) {
  return (
    <div className="min-w-[4.5rem]">
      <p className={`font-mono text-2xl font-semibold leading-none tracking-tight ${
        tone === "good" ? "text-emerald-600 dark:text-emerald-500"
          : tone === "alert" ? "text-amber-700 dark:text-amber-500" : "text-foreground"}`}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-1 text-[10.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default async function StatistiquesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bootcamp, s] = await Promise.all([getBootcampById(id), getFormationStats(id)]);
  if (!bootcamp) notFound();

  // Les règles tournent UNE fois ici. La pastille, le bandeau ambre et le
  // conseil lisent tous les trois le même résultat.
  const gaps = detectGaps(s);
  const g = (b: GapBlock) => gapFor(gaps, b);

  const devise = bootcamp.currency ?? "TND";
  const maxJour = Math.max(1, ...s.rythme.map((r) => Math.max(r.arrivees, r.appels)));
  const maxCol = Math.max(1, ...s.colonnes.map((c) => c.n));
  const maxSejour = Math.max(1, ...s.sejours.map((x) => x.mediane));
  const maxLien = Math.max(1, ...s.emails.liens.map((l) => l.n));

  const totalArrivees = s.rythme.reduce((a, r) => a + r.arrivees, 0);
  const totalAppels = s.rythme.reduce((a, r) => a + r.appels, 0);
  const colBloquante = [...s.colonnes].sort((a, b) => b.n - a.n)[0];
  const goulot = [...s.sejours].sort((a, b) => b.passages - a.passages)[0];
  const aboutisTotal = s.gens.reduce((a, g) => a + g.aboutis, 0);

  const pc = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
  const dt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-5">
        <Link
          href={`/bootcamps/${id}`}
          title="Retour à la formation"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-sm font-semibold text-foreground">Statistiques</h1>
          <p className="truncate text-xs text-muted-foreground">{bootcamp.name}</p>
        </div>
        <span className="hidden shrink-0 rounded-full border border-primary bg-primary/10 px-3 py-1 text-[10.5px] font-medium text-primary sm:block">
          Toute la formation
          {bootcamp.startDate ? ` · depuis le ${formatDate(bootcamp.startDate)}` : ""}
        </span>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto bg-muted/20 p-4 sm:p-5">
        {/* ── Le bandeau ── */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {[
            { v: dt(s.socle.leads), k: "leads", alert: false },
            { v: dt(s.socle.veulentAppel), k: "ont demandé un appel", alert: s.socle.veulentAppel > s.socle.appels },
            { v: dt(s.socle.appels), k: "appels passés", alert: false },
            { v: dt(s.socle.inscrits), k: "inscrits", alert: false },
          ].map((k) => (
            <div key={k.k} className="bg-card px-3.5 py-3">
              <p className={`font-mono text-[22px] font-semibold leading-none tracking-tight ${
                k.alert ? "text-amber-700 dark:text-amber-500" : "text-foreground"}`}>
                {k.v}
              </p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">{k.k}</p>
            </div>
          ))}
        </div>

        {/* ── 1. Le rythme ── */}
        <Card
          title="Le rythme"
          sub="Ce qui entre, et ce qu'on traite — les 7 derniers jours"
          gap={g("rythme")}
          bootcampId={id}
          verdict={
            <>
              <strong>{totalArrivees} leads entrés, {totalAppels} appels passés</strong> sur ces 7 jours.
            </>
          }
        >
          <div className="flex h-[150px] items-end gap-3 pt-2">
            {s.rythme.map((r) => (
              <div key={r.jour} className="flex min-w-0 flex-1 flex-col justify-end gap-1.5">
                <div className="flex h-[124px] items-end gap-[3px]">
                  {/* Une barre de 2 px quand la valeur est zéro : sinon la journée
                      disparaît, alors que « zéro appel » est l'information. */}
                  <div
                    className="relative flex-1 rounded-t-[3px] bg-primary/25"
                    style={{ height: `${Math.max((r.arrivees / maxJour) * 124, 2)}px` }}
                  >
                    <span className="absolute -top-3.5 left-0 right-0 text-center font-mono text-[9.5px] font-semibold text-muted-foreground">
                      {r.arrivees}
                    </span>
                  </div>
                  <div
                    className="relative flex-1 rounded-t-[3px] bg-primary"
                    style={{ height: `${Math.max((r.appels / maxJour) * 124, 2)}px` }}
                  >
                    <span className="absolute -top-3.5 left-0 right-0 text-center font-mono text-[9.5px] font-semibold text-primary">
                      {r.appels}
                    </span>
                  </div>
                </div>
                <p className="text-center font-mono text-[9.5px] text-muted-foreground">{r.jour}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary/25" />Leads entrés
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" />Appels passés
            </span>
          </div>
        </Card>

        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* ── 2. Où ils sont ── */}
          <Card
            title="Où ils sont"
            sub="Répartition dans les colonnes"
            gap={g("colonnes")}
            bootcampId={id}
          >
            <div className="space-y-1.5">
              {s.colonnes.map((c) => (
                <Row
                  key={c.name}
                  label={c.name}
                  pct={(c.n / maxCol) * 100}
                  value={dt(c.n)}
                  tone={
                    c === colBloquante && s.socle.leads > 0 && c.n / s.socle.leads > 0.5 ? "alert"
                      : c.n === 0 ? "soft" : "normal"
                  }
                />
              ))}
            </div>
          </Card>

          {/* ── 3. Le temps ── */}
          <Card
            title="Le temps"
            sub={s.delais ? `De l'arrivée à l'inscription · sur ${s.delais.surCombien} inscrit${s.delais.surCombien > 1 ? "s" : ""}` : "De l'arrivée à l'inscription"}
            gap={g("temps")}
            bootcampId={id}
          >
            {s.delais ? (
              <div className="flex flex-wrap gap-5">
                <Big value={String(s.delais.min).replace(".", ",")} unit="j" label="le plus rapide" />
                <Big value={String(s.delais.moyen).replace(".", ",")} unit="j" label="en moyenne" />
                <Big value={String(s.delais.max).replace(".", ",")} unit="j" label="le plus lent" />
              </div>
            ) : (
              <p className="text-[11.5px] text-muted-foreground">
                Aucune inscription pour l&apos;instant — le délai apparaîtra à la première.
              </p>
            )}

            {s.sejours.length > 0 && (
              <>
                <p className="mb-2.5 mt-4 text-[11px] text-muted-foreground">
                  Temps médian passé dans chaque colonne
                </p>
                <div className="space-y-1.5">
                  {s.sejours.slice(0, 5).map((x) => (
                    <Row
                      key={x.name}
                      label={x.name}
                      hint={`${x.passages}×`}
                      pct={(x.mediane / maxSejour) * 100}
                      value={x.mediane > 0 ? `${String(x.mediane).replace(".", ",")} j` : "< 1 j"}
                      tone={x === goulot ? "alert" : "soft"}
                    />
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ── 4. Les gens ── */}
        <Card
          title="Les gens"
          sub="Qui a fait quoi sur cette formation"
          verdict={
            s.socle.appels > 0 ? (
              <>
                Sur {s.socle.appels} appels, <strong>{aboutisTotal} aboutissent</strong>
                {" "}({pc(aboutisTotal, s.socle.appels)} %) — quand on décroche le téléphone, ça répond.
              </>
            ) : undefined
          }
        >
          {s.gens.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground">Aucune action humaine enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Personne", "Appels", "Aboutis", "Taux", "Déplacements", "Commentaires"].map((h, i) => (
                      <th
                        key={h}
                        className={`pb-2 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground ${
                          i === 0 ? "text-left" : "text-right"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.gens.map((g) => (
                    <tr key={g.actor ?? "inconnu"} className="border-b border-border last:border-0">
                      <td className={`py-2 ${g.actor ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {actorName(g.actor)}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{g.appels}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{g.aboutis}</td>
                      <td className="py-2 text-right">
                        {g.appels > 0 ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-emerald-700 dark:text-emerald-500">
                            {pc(g.aboutis, g.appels)} %
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums">{g.deplacements}</td>
                      <td className="py-2 text-right font-mono tabular-nums">{g.commentaires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid gap-3.5 lg:grid-cols-2">
          {/* ── 5. L'argent ── */}
          <Card
            title="L'argent"
            sub={`Échéancier des ${s.socle.inscrits} inscrit${s.socle.inscrits > 1 ? "s" : ""}`}
            gap={g("argent")}
            bootcampId={id}
          >
            <div className="flex flex-wrap gap-5">
              <Big value={dt(s.argent.encaisse)} unit={devise} label="encaissé" />
              <Big value={dt(s.argent.reste)} unit={devise} label="reste à devoir" />
              <Big
                value={dt(s.argent.enRetard)}
                label="en retard"
                tone={s.argent.enRetard === 0 ? "good" : "alert"}
              />
            </div>

            {s.argent.parMoyen.length > 0 && (
              <>
                <p className="mb-2.5 mt-4 text-[11px] text-muted-foreground">Par moyen de paiement</p>
                <div className="space-y-1.5">
                  {s.argent.parMoyen.map((m) => {
                    const max = Math.max(1, ...s.argent.parMoyen.map((x) => x.n));
                    return (
                      <Row
                        key={m.method ?? "inconnu"}
                        label={m.method ? METHOD_LABEL[m.method] ?? m.method : "Non renseigné"}
                        pct={(m.n / max) * 100}
                        value={dt(m.n)}
                        tone={m.method ? "normal" : "soft"}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {/* ── 6. Les emails ── */}
          <Card
            title="Les emails"
            sub="Automatisations de cette formation"
            gap={g("emails")}
            bootcampId={id}
          >
            {s.emails.envoyes === 0 ? (
              <p className="text-[11.5px] text-muted-foreground">
                Aucun email d&apos;automatisation envoyé sur cette formation.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-5">
                  <Big value={dt(s.emails.envoyes)} label="envoyés" />
                  <Big value={dt(s.emails.ouverts)} label={`ouverts · ${pc(s.emails.ouverts, s.emails.envoyes)} %`} />
                  <Big value={dt(s.emails.cliques)} label={`cliqués · ${pc(s.emails.cliques, s.emails.envoyes)} %`} />
                </div>

                {s.emails.liens.length > 0 && (
                  <>
                    <p className="mb-2.5 mt-4 text-[11px] text-muted-foreground">Liens les plus cliqués</p>
                    <div className="space-y-1.5">
                      {s.emails.liens.map((l) => (
                        <Row
                          key={l.url}
                          label={l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          pct={(l.n / maxLien) * 100}
                          value={dt(l.n)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
