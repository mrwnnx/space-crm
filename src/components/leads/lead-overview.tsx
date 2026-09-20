import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { Recommendation } from "@/lib/lead-recommendation";
import { LinkedTasks } from "@/components/tasks/linked-tasks";

/**
 * L'onglet Aperçu d'une fiche : « où en est-on avec cette personne ? » en un
 * regard. Tout est calculé côté serveur (page.tsx) à partir de ce que la
 * fiche charge déjà ; ce composant ne fait que le poser en six blocs.
 */

export type OverviewData = {
  /** Où en est-on */
  stageName: string | null;
  stageDays: number;
  qualification: string | null;
  nextFollowUpAt: Date | null;
  silenceDays: number | null;
  /** Canaux */
  email: {
    address: string | null;
    bounced: boolean;
    unsubscribed: boolean;
    lastCampaign: { name: string; sentAt: Date | null; openedAt: Date | null; clickedAt: Date | null } | null;
  };
  whatsapp: {
    number: string | null;
    consentAt: Date | null;
    consentSource: string | null;
    unsubscribedAt: Date | null;
    windowOpenUntil: Date | null;
    last: { at: Date; direction: "inbound" | "outbound" } | null;
  };
  phone: {
    number: string | null;
    wantsCall: boolean | null;
    callCount: number;
    lastCall: { at: Date; status: string } | null;
  };
  /** Dernier échange venu du lead */
  lastExchange: { at: Date; channel: string; excerpt: string } | null;
  /** Argent */
  money: {
    offer: string | null;
    paidCount: number;
    count: number;
    paidAmount: number;
    total: number;
    currency: string;
    nextDue: { dueDate: Date | null; amount: number | null } | null;
  } | null;
  /** Origine */
  origin: {
    source: string | null;
    createdAt: Date;
    situation: string | null;
    motivation: string | null;
    carriedFrom: string | null;
    multiForm: boolean;
  };
  /** À venir */
  scheduled: { id: string; at: Date | null; label: string; channel: string; reason: string | null }[];
};

const QUALIF: Record<string, string> = {
  chaud: "🔥 Chaud",
  tiede: "Tiède",
  froid: "Froid",
  pas_serieux: "Pas sérieux",
  hors_cible: "Hors cible",
  reporte: "Reporté",
};

const TONE: Record<Recommendation["tone"], { label: string; cls: string; ring: string }> = {
  now: { label: "À appeler maintenant", cls: "text-emerald-800", ring: "border-emerald-300 bg-emerald-50" },
  soon: { label: "À traiter bientôt", cls: "text-sky-800", ring: "border-sky-300 bg-sky-50" },
  wait: { label: "Ne rien faire pour l'instant", cls: "text-amber-900", ring: "border-amber-300 bg-amber-50" },
  stop: { label: "Ne pas relancer", cls: "text-muted-foreground", ring: "border-border bg-muted/40" },
};

const CALL_STATUS: Record<string, string> = {
  completed: "répondu",
  no_answer: "sans réponse",
  busy: "occupé",
  failed: "échec",
  canceled: "annulé",
};

function Bloc({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-2.5 rounded-xl border border-border p-4", className)}>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Ligne({ k, v, accent }: { k: string; v: React.ReactNode; accent?: "warn" | "ok" }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{k}</span>
      <span className={cn("text-right text-sm", accent === "warn" && "text-amber-700", accent === "ok" && "text-green-700")}>{v}</span>
    </div>
  );
}

function Canal({ ok, name, detail }: { ok: boolean | null; name: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          "mt-[7px] h-2 w-2 shrink-0 rounded-full",
          ok === true ? "bg-green-600" : ok === false ? "bg-red-500" : "bg-muted-foreground/40"
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-[13px] text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const montant = (n: number, cur: string) => `${Math.round(n).toLocaleString("fr-FR")} ${cur}`;

export function LeadOverview({
  data,
  recommendation,
  leadId,
  tasks,
}: {
  data: OverviewData;
  recommendation: Recommendation;
  leadId: string;
  tasks: React.ComponentProps<typeof LinkedTasks>["tasks"];
}) {
  const tone = TONE[recommendation.tone];
  const wa = data.whatsapp;
  const ph = data.phone;
  const em = data.email;

  return (
    <div className="space-y-4 p-4 lg:flex-1 lg:overflow-y-auto">
      {/* Le bandeau : la décision, avant les faits qui l'ont produite. */}
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3", tone.ring)}>
        <span className={cn("text-[12px] font-semibold uppercase tracking-wide", tone.cls)}>{tone.label}</span>
        <span className="text-sm text-foreground">{recommendation.action}</span>
        {recommendation.because.length > 0 && (
          <span className="text-[13px] text-muted-foreground">— {recommendation.because.join(" · ")}</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Bloc title="Où en est-on">
          <Ligne k="Colonne" v={<span className="font-medium">{data.stageName ?? "—"}{data.stageName ? ` · depuis ${data.stageDays} j` : ""}</span>} />
          <Ligne k="Qualification" v={data.qualification ? QUALIF[data.qualification] ?? data.qualification : "—"} />
          <Ligne k="Prochain rappel" v={data.nextFollowUpAt ? formatDate(data.nextFollowUpAt) : "—"} />
          <Ligne
            k="Silence depuis"
            v={data.silenceDays === null ? "jamais écrit" : data.silenceDays === 0 ? "aujourd'hui" : `${data.silenceDays} j`}
            accent={data.silenceDays !== null && data.silenceDays >= 3 ? "warn" : undefined}
          />
        </Bloc>

        <Bloc title="Canaux">
          <Canal
            ok={em.address ? !em.bounced && !em.unsubscribed : null}
            name="Email"
            detail={
              !em.address
                ? "Aucune adresse"
                : em.bounced
                  ? "Adresse invalide (rebond)"
                  : em.unsubscribed
                    ? "Désabonné des campagnes"
                    : em.lastCampaign
                      ? `${em.lastCampaign.name} — ${em.lastCampaign.clickedAt ? "cliqué" : em.lastCampaign.openedAt ? "ouvert" : "envoyé"}${em.lastCampaign.sentAt ? ` ${formatRelative(em.lastCampaign.sentAt)}` : ""}`
                      : "Aucune campagne reçue"
            }
          />
          <Canal
            ok={wa.number ? (wa.unsubscribedAt ? false : wa.consentAt ? true : null) : null}
            name="WhatsApp"
            detail={
              !wa.number
                ? "Aucun numéro"
                : wa.unsubscribedAt
                  ? `A répondu STOP le ${formatDate(wa.unsubscribedAt)}`
                  : [
                      wa.consentAt ? "Consentement ✓" : "Sans consentement — utilitaire seulement",
                      wa.windowOpenUntil ? `fenêtre ouverte jusqu'à ${heure(wa.windowOpenUntil)}` : null,
                      wa.last ? `dernier : ${wa.last.direction === "inbound" ? "lui" : "nous"}, ${formatRelative(wa.last.at)}` : "aucun message",
                    ]
                      .filter(Boolean)
                      .join(" · ")
            }
          />
          <Canal
            ok={ph.lastCall ? ph.lastCall.status === "completed" : null}
            name="Téléphone"
            detail={
              !ph.number
                ? "Aucun numéro"
                : [
                    ph.callCount ? `${ph.callCount} appel${ph.callCount > 1 ? "s" : ""}` : "Aucun appel",
                    ph.lastCall ? `dernier ${CALL_STATUS[ph.lastCall.status] ?? ph.lastCall.status} ${formatRelative(ph.lastCall.at)}` : null,
                    ph.wantsCall ? "a demandé un rappel" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
          />
        </Bloc>

        <Bloc title="Dernier échange">
          {data.lastExchange ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                {data.lastExchange.channel} · {formatRelative(data.lastExchange.at)}
              </p>
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">{data.lastExchange.excerpt}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Cette personne ne nous a jamais écrit ni répondu.</p>
          )}
        </Bloc>

        {data.money && (
          <Bloc title="Argent">
            <Ligne k="Offre" v={data.money.offer ?? "—"} />
            <Ligne
              k="Encaissé"
              v={<span className="font-medium">{montant(data.money.paidAmount, data.money.currency)} / {montant(data.money.total, data.money.currency)}</span>}
            />
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-foreground"
                style={{ width: `${data.money.total ? Math.min(100, Math.round((data.money.paidAmount / data.money.total) * 100)) : 0}%` }}
              />
            </div>
            <Ligne
              k="Prochaine échéance"
              v={
                data.money.nextDue
                  ? `${data.money.nextDue.amount != null ? montant(data.money.nextDue.amount, data.money.currency) : ""}${data.money.nextDue.dueDate ? ` · ${formatDate(data.money.nextDue.dueDate)}` : ""}`
                  : "tout est payé"
              }
            />
          </Bloc>
        )}

        <Bloc title="Origine">
          <Ligne k="Source" v={data.origin.source ?? "—"} />
          <Ligne k="Arrivé le" v={formatDate(data.origin.createdAt)} />
          {data.origin.situation && <Ligne k="Situation" v={data.origin.situation} />}
          {data.origin.motivation && (
            <p className="text-sm italic text-foreground">« {data.origin.motivation} »</p>
          )}
          {data.origin.carriedFrom && (
            <p className="text-[13px] text-muted-foreground">↪ Reporté de « {data.origin.carriedFrom} »</p>
          )}
          {data.origin.multiForm && (
            <p className="text-[13px] text-muted-foreground">A rempli plusieurs formulaires</p>
          )}
        </Bloc>

        <Bloc title="À venir" className={cn(!data.money && "md:col-span-2 xl:col-span-1")}>
          <LinkedTasks tasks={tasks} referenceType="lead" referenceId={leadId} embedded />
          <h4 className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Messages programmés</h4>
          {data.scheduled.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Aucun message automatique en attente.</p>
          ) : (
            <ul className="space-y-1">
              {data.scheduled.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm">
                    <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[11px] uppercase text-muted-foreground">{s.channel === "whatsapp" ? "WA" : "Email"}</span>
                    {s.label}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground" title={s.reason ?? undefined}>
                    {s.at ? formatRelative(s.at) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.scheduled.length > 0 && (
            <p className="text-[12px] text-muted-foreground">S&apos;arrêtent dès que la personne répond, change de colonne ou s&apos;inscrit.</p>
          )}
        </Bloc>
      </div>
    </div>
  );
}
