import Link from "next/link";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { getBootcampById } from "@/lib/queries";
import { detailBlast, listerBlasts } from "@/lib/whatsapp-blast";
import { formatDateTime } from "@/lib/utils";
import { RelancerEchecs } from "@/components/whatsapp/relancer-echecs";

export const dynamic = "force-dynamic";

/**
 * L'historique des envois de modèles WhatsApp à une colonne entière.
 *
 * Une vague se lit d'un coup d'œil (combien partis, combien sautés) et
 * s'ouvre pour voir QUI — c'est ce qu'on cherche quand quelqu'un dit « je n'ai
 * rien reçu ». Les fiches sautées portent leur motif.
 */
export default async function EnvoisPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vague?: string }>;
}) {
  const { id } = await params;
  const { vague } = await searchParams;
  const bootcamp = await getBootcampById(id);
  if (!bootcamp) notFound();

  const vagues = await listerBlasts(id);
  const ouverte = vague && vagues.some((v) => v.id === vague) ? vague : null;
  const detail = ouverte ? await detailBlast(ouverte) : null;

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
        <div className="min-w-0">
          <h1 className="truncate font-heading text-sm font-semibold text-foreground">
            Envois WhatsApp
          </h1>
          <p className="truncate text-xs text-muted-foreground">{bootcamp.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {vagues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun envoi en masse sur cette formation. Ils se lancent depuis le menu d&apos;une
            colonne du kanban, « Envoyer un modèle WhatsApp ».
          </p>
        ) : (
          <div className="space-y-2">
            {vagues.map((v) => {
              const actif = v.id === ouverte;
              return (
                <div key={v.id} className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {v.template}
                        <span className="ml-2 font-normal text-muted-foreground">
                          → colonne « {v.colonne} »
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(v.createdAt)}
                        {v.createdBy ? ` · ${v.createdBy}` : ""}
                        {v.capPolicy === "exclure" ? " · plafond : exclus" : " · plafond : reportés"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs tabular-nums">
                      <Chiffre n={v.sent} label="envoyés" ton="text-green-700 dark:text-green-400" />
                      {v.sent > 0 && (
                        <Chiffre n={v.recus} label="reçus" ton="text-green-700 dark:text-green-400" />
                      )}
                      {v.lus > 0 && <Chiffre n={v.lus} label="lus" ton="text-green-700 dark:text-green-400" />}
                      {v.nonLivres > 0 && (
                        <Chiffre n={v.nonLivres} label="non livrés" ton="text-red-600 dark:text-red-400" />
                      )}
                      {v.pending > 0 && (
                        <Chiffre n={v.pending} label="en attente" ton="text-amber-700 dark:text-amber-500" />
                      )}
                      {v.skipped > 0 && <Chiffre n={v.skipped} label="sautés" ton="text-muted-foreground" />}
                      {v.failed > 0 && <Chiffre n={v.failed} label="échecs" ton="text-red-600 dark:text-red-400" />}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] ${
                          v.state === "done"
                            ? "bg-muted text-muted-foreground"
                            : v.state === "paused"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : "bg-green-500/10 text-green-700 dark:text-green-400"
                        }`}
                      >
                        {v.state === "done" ? "terminée" : v.state === "paused" ? "arrêtée" : "en cours"}
                      </span>
                      <Link
                        href={actif ? `/bootcamps/${id}/envois` : `/bootcamps/${id}/envois?vague=${v.id}`}
                        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        {actif ? "Fermer" : "Détail"}
                      </Link>
                    </div>
                  </div>

                  {(v.reponses > 0 || v.formulaires > 0 || v.pasInteresses > 0 || v.failed + v.nonLivres > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs">
                      <span className="text-muted-foreground">Résultats :</span>
                      {v.formulaires > 0 && (
                        <Chiffre n={v.formulaires} label="formulaires remplis" ton="text-violet-700 dark:text-violet-400" />
                      )}
                      <Chiffre n={v.reponses} label="ont répondu" ton="text-foreground" />
                      {v.pasInteresses > 0 && (
                        <Chiffre n={v.pasInteresses} label="« ما يهمنيش »" ton="text-muted-foreground" />
                      )}
                      <span className="flex-1" />
                      {v.failed + v.nonLivres > 0 && v.state !== "running" && (
                        <RelancerEchecs blastId={v.id} bootcampId={id} n={v.failed + v.nonLivres} />
                      )}
                    </div>
                  )}

                  {actif && detail && (
                    <div className="border-t border-border px-4 py-3">
                      <Raisons detail={detail} />
                      <ul className="space-y-1 text-[13px]">
                        {detail.map((d) => (
                          <li key={d.leadId} className="flex flex-wrap items-baseline gap-x-2">
                            <span className={`w-20 shrink-0 ${TON[d.status] ?? "text-muted-foreground"}`}>
                              {LIBELLE[d.status] ?? d.status}
                            </span>
                            <Link href={`/leads/${d.leadId}`} className="font-medium text-foreground hover:underline">
                              {d.nom}
                            </Link>
                            {d.numero && <span className="text-muted-foreground">{d.numero}</span>}
                            {d.reason && <span className="text-muted-foreground">— {d.reason}</span>}
                            {d.meta && d.meta !== "sent" && (
                              <span className={META_TON[d.meta] ?? "text-muted-foreground"}>
                                · {META[d.meta] ?? d.meta}
                                {d.metaErreur ? ` — ${d.metaErreur}` : ""}
                              </span>
                            )}
                            {d.status === "pending" && d.scheduledAt && (
                              <span className="text-muted-foreground">
                                — prévu {formatDateTime(d.scheduledAt)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const LIBELLE: Record<string, string> = {
  sent: "Envoyé",
  pending: "En attente",
  skipped: "Sauté",
  failed: "Échec",
};
const TON: Record<string, string> = {
  sent: "text-green-700 dark:text-green-400",
  pending: "text-amber-700 dark:text-amber-500",
  failed: "text-red-600 dark:text-red-400",
};

function Chiffre({ n, label, ton }: { n: number; label: string; ton: string }) {
  return (
    <span className={ton}>
      <strong className="font-semibold">{n}</strong>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

const META: Record<string, string> = { delivered: "reçu", read: "lu", failed: "non livré par Meta" };
const META_TON: Record<string, string> = {
  delivered: "text-green-700 dark:text-green-400",
  read: "text-green-700 dark:text-green-400",
  failed: "text-red-600 dark:text-red-400",
};

/** Le « pourquoi » d'une vague d'un coup d'œil : chaque raison, combien de personnes. */
function Raisons({ detail }: { detail: { status: string; reason: string | null; meta: string | null; metaErreur: string | null }[] }) {
  const compte = new Map<string, number>();
  for (const d of detail) {
    const r = d.meta === "failed" ? `Non livré par Meta — ${d.metaErreur ?? "sans détail"}` : d.status !== "sent" && d.reason ? d.reason : null;
    if (r) compte.set(r, (compte.get(r) ?? 0) + 1);
  }
  if (compte.size === 0) return null;
  return (
    <ul className="mb-3 space-y-0.5 rounded-lg bg-muted/50 p-3 text-[12.5px]">
      {[...compte.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([r, n]) => (
          <li key={r}>
            <strong className="tabular-nums text-foreground">{n}</strong> <span className="text-muted-foreground">{r}</span>
          </li>
        ))}
    </ul>
  );
}

