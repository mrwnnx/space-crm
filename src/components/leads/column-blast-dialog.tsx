"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  apercuBlastAction,
  arreterBlastAction,
  etatBlastAction,
  lancerBlastAction,
  listApprovedTemplatesAction,
} from "@/app/whatsapp-actions";
import { ApercuModele } from "@/components/whatsapp/template-preview";

type Catalogue = Awaited<ReturnType<typeof listApprovedTemplatesAction>>;
type Apercu = Awaited<ReturnType<typeof apercuBlastAction>>;
type Etat = Awaited<ReturnType<typeof etatBlastAction>>;

const VARIABLES = ["firstName", "lastName", "fullName", "formation", "dateDebut", "offre", "email"] as const;

/**
 * Envoyer un modèle à TOUS les leads d'une colonne, maintenant.
 *
 * L'écran ne laisse jamais cliquer à l'aveugle : dès que le modèle et ses
 * variables sont choisis, il annonce qui part, qui est reporté et qui est
 * sauté — avec le motif. Le plafond « 1 marketing par 24 h » est le seul dont
 * l'issue se choisit ici : reporter ces personnes, ou les laisser hors vague.
 */
export function ColumnBlastDialog({
  bootcampId,
  statusId,
  columnName,
  onClose,
}: {
  bootcampId: string;
  statusId: string;
  columnName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [nom, setNom] = useState("");
  const [valeurs, setValeurs] = useState<string[]>([]);
  const [capPolicy, setCapPolicy] = useState<"reporter" | "exclure">("reporter");
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [blastId, setBlastId] = useState<string | null>(null);
  const [etat, setEtat] = useState<Etat>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listApprovedTemplatesAction(bootcampId)
      .then(setCatalogue)
      .catch(() => setCatalogue({ modeles: [], exemples: { fr: {}, ar: {} } }));
  }, [bootcampId]);

  const modele = catalogue?.modeles.find((m) => m.name === nom) ?? null;
  const exemples = catalogue?.exemples[modele?.language.startsWith("ar") ? "ar" : "fr"] ?? {};
  const complet = !!modele && valeurs.slice(0, modele.variables).every((v) => v?.trim());

  // Le décompte se refait à chaque changement de modèle, de variable ou de
  // politique : c'est lui qui donne le droit de cliquer.
  useEffect(() => {
    if (!modele || !complet) return setApercu(null);
    let vivant = true;
    setCalcul(true);
    apercuBlastAction(statusId, { template: modele.name, language: modele.language, variables: valeurs }, capPolicy)
      .then((a) => vivant && setApercu(a))
      .catch(() => vivant && setApercu(null))
      .finally(() => vivant && setCalcul(false));
    return () => {
      vivant = false;
    };
  }, [statusId, modele, valeurs, capPolicy, complet]);

  // Vague en cours : on suit l'avancement, le cron travaille en fond.
  useEffect(() => {
    if (!blastId) return;
    const tic = () => etatBlastAction(blastId).then(setEtat);
    tic();
    const t = setInterval(tic, 5000);
    return () => clearInterval(t);
  }, [blastId]);

  function choisir(name: string) {
    setNom(name);
    setApercu(null);
    const m = catalogue?.modeles.find((x) => x.name === name);
    if (!m) return setValeurs([]);
    const d = catalogue!.exemples[m.language.startsWith("ar") ? "ar" : "fr"];
    // {{1}} est le prénom neuf fois sur dix ; le reste se remplit à la main.
    setValeurs(Array.from({ length: m.variables }, (_, i) => (i === 0 ? (d.firstName ? "firstName" : "") : "")));
  }

  function lancer() {
    if (!modele || !apercu || isPending) return;
    setErreur(null);
    startTransition(async () => {
      const r = await lancerBlastAction({
        bootcampId,
        statusId,
        template: modele.name,
        language: modele.language,
        variables: valeurs,
        capPolicy,
      });
      if (!r.ok) return setErreur(r.error);
      setBlastId(r.blastId);
      router.refresh();
    });
  }

  // Une valeur affichée : un nom de variable du CRM montre l'exemple du lead.
  const rendu = valeurs.map((v) => exemples[v] ?? v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-xl"
      >
        <div className="px-5 pt-5">
          <h2 className="mb-1 font-heading text-sm font-semibold text-foreground">
            Envoyer un modèle à la colonne « {columnName} »
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Part <strong>maintenant</strong> à tous les leads qui sont dans cette colonne — sans
            attendre qu&apos;ils y entrent. Chacun reçoit ses propres valeurs.{" "}
            <a
              href={`/bootcamps/${bootcampId}/envois`}
              className="text-primary underline underline-offset-2"
            >
              Voir les envois passés
            </a>
            .
          </p>
        </div>

        {blastId ? (
          <SuiviVague etat={etat} onArreter={() => arreterBlastAction(blastId).then(() => etatBlastAction(blastId).then(setEtat))} />
        ) : (
          <div className="grid flex-1 gap-x-6 overflow-y-auto px-5 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Modèle approuvé par Meta</label>
              {catalogue === null ? (
                <p className="text-[13px] text-muted-foreground">Chargement des modèles…</p>
              ) : (
                <select
                  value={nom}
                  onChange={(e) => choisir(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  <option value="">Choisir un modèle…</option>
                  {catalogue.modeles.map((m) => (
                    <option key={`${m.name}|${m.language}`} value={m.name}>
                      {m.name} — {m.language} · {m.category === "MARKETING" ? "marketing" : "utilitaire"}
                      {m.variables ? ` · ${m.variables} variable${m.variables > 1 ? "s" : ""}` : ""}
                    </option>
                  ))}
                </select>
              )}

              {modele && modele.variables > 0 && (
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Variables, dans l&apos;ordre
                  </label>
                  <div className="space-y-2">
                    {Array.from({ length: modele.variables }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 font-mono text-[12px] text-muted-foreground">{`{{${i + 1}}}`}</span>
                        <select
                          value={(VARIABLES as readonly string[]).includes(valeurs[i]) ? valeurs[i] : "__fixe"}
                          onChange={(e) => {
                            const v = [...valeurs];
                            v[i] = e.target.value === "__fixe" ? "" : e.target.value;
                            setValeurs(v);
                          }}
                          className="w-36 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
                        >
                          {VARIABLES.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                          <option value="__fixe">valeur fixe…</option>
                        </select>
                        {!(VARIABLES as readonly string[]).includes(valeurs[i]) && (
                          <input
                            value={valeurs[i] ?? ""}
                            onChange={(e) => {
                              const v = [...valeurs];
                              v[i] = e.target.value;
                              setValeurs(v);
                            }}
                            placeholder="ex. 28 سبتمبر"
                            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Une variable du CRM prend la valeur de chaque lead. Une valeur fixe est la même
                    pour tous.
                  </p>
                </div>
              )}
            </div>

            <div>
              {modele?.body && <ApercuModele body={modele.body} buttons={modele.buttons} valeurs={rendu} />}

              {modele && modele.category === "MARKETING" && (
                <div className="mb-4">
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Ceux qui ont reçu un marketing il y a moins de 24 h
                  </label>
                  <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
                    {(
                      [
                        ["reporter", "Les reporter"],
                        ["exclure", "Les exclure"],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setCapPolicy(v)}
                        className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors ${
                          capPolicy === v
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {capPolicy === "reporter"
                      ? "Ils recevront le message dès que leur plafond se libère."
                      : "Ils ne reçoivent rien de cette vague."}
                  </p>
                </div>
              )}

              {calcul && <p className="text-[13px] text-muted-foreground">Calcul du décompte…</p>}
              {apercu && !calcul && <Decompte a={apercu} />}
            </div>
          </div>
        )}

        <div className="px-5 pb-5 pt-3">
          {erreur && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
              {erreur}
            </div>
          )}
          <div className="flex gap-2">
            {!blastId && (
              <button
                disabled={isPending || !apercu || apercu.envoyer + apercu.reporter === 0}
                onClick={lancer}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending
                  ? "Mise en file…"
                  : apercu
                    ? `Envoyer à ${apercu.envoyer} lead${apercu.envoyer > 1 ? "s" : ""}`
                    : "Envoyer"}
              </button>
            )}
            <button
              onClick={onClose}
              className={`rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted ${blastId ? "flex-1" : ""}`}
            >
              {blastId ? "Fermer" : "Retour"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Le décompte : ce qui va se passer si on clique. */
function Decompte({ a }: { a: Apercu }) {
  const report = a.premierReport
    ? new Date(a.premierReport).toLocaleString("fr-FR", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Tunis",
      })
    : null;
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {a.total} lead{a.total > 1 ? "s" : ""} dans la colonne
      </p>
      <p className="text-foreground">
        <strong className="text-green-700 dark:text-green-400">{a.envoyer}</strong> reçoivent le
        message maintenant.
      </p>
      {a.reporter > 0 && (
        <p className="text-foreground">
          <strong className="text-amber-700 dark:text-amber-500">{a.reporter}</strong> reportés
          {report ? ` — le premier ${report}` : ""}.
        </p>
      )}
      {a.sauter > 0 && (
        <>
          <p className="mt-1 text-foreground">
            <strong>{a.sauter}</strong> sautés :
          </p>
          <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
            {a.motifs.map((m) => (
              <li key={m.raison}>
                {m.n} — {m.raison}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Une fois lancée : l'avancement, et de quoi arrêter. */
function SuiviVague({ etat, onArreter }: { etat: Etat; onArreter: () => void }) {
  if (!etat) return <div className="px-5 pb-2 text-sm text-muted-foreground">Mise en file…</div>;
  const fini = etat.pending === 0;
  return (
    <div className="flex-1 overflow-y-auto px-5">
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          {fini ? "Vague terminée" : etat.state === "paused" ? "Vague arrêtée" : "Envoi en cours…"}
        </p>
        <div className="grid grid-cols-2 gap-2 text-[13px] sm:grid-cols-4">
          <Chiffre n={etat.sent} label="envoyés" ton="text-green-700 dark:text-green-400" />
          <Chiffre n={etat.pending} label="en attente" ton="text-amber-700 dark:text-amber-500" />
          <Chiffre n={etat.skipped} label="sautés" ton="text-muted-foreground" />
          <Chiffre n={etat.failed} label="échecs" ton="text-red-600 dark:text-red-400" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          La file part par paquets, toutes les 5 minutes — Meta n&apos;accepte pas une rafale. Tu
          peux fermer cette fenêtre, l&apos;envoi continue.
        </p>
        {!fini && etat.state === "running" && (
          <button
            type="button"
            onClick={onArreter}
            className="mt-2 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-600 hover:bg-red-500/5 dark:text-red-400"
          >
            Arrêter la vague
          </button>
        )}
      </div>
    </div>
  );
}

function Chiffre({ n, label, ton }: { n: number; label: string; ton: string }) {
  return (
    <div>
      <div className={`text-lg font-semibold tabular-nums ${ton}`}>{n}</div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}
