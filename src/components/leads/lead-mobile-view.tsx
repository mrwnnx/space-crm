"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  ArrowRight02Icon,
  Call02Icon,
  WhatsappIcon,
  Mail01Icon,
  Note02Icon,
  Copy01Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import {
  updateLeadStatusAction,
  addLeadNoteAction,
  logCallOutcomeAction,
  setLeadFollowUpAction,
  markLeadLostAction,
} from "@/app/actions";
import { cn, initials } from "@/lib/utils";
import { QUALIFICATIONS } from "@/components/leads/call-outcome-form";
import { EnrollLeadDialog } from "@/components/leads/enroll-lead-dialog";
import { WhatsAppComposer } from "@/components/activities/whatsapp-composer";
import { EmailComposer } from "@/components/activities/email-composer";
import type { Lead, Bootcamp, EmailTemplate } from "@/db/schema";

/**
 * La fiche lead sur téléphone (< lg). Une colonne, tout au pouce : les
 * coordonnées actionnables en haut, la prochaine action, puis ce qu'il faut
 * savoir ; les 4 gestes du quotidien dans une barre fixe en bas, chacun dans
 * une feuille qui monte du bas. Le bureau garde la fiche à onglets.
 */

type Stage = { id: string; name: string; kind: string };
type Recent = { id: string; at: string; label: string };

export type LeadMobileData = {
  id: string;
  fullName: string;
  origin: string;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  statusId: string | null;
  statusName: string | null;
  statuses: Stage[];
  qualification: string | null;
  /** Calculé côté serveur : l'heure « maintenant » ne se lit pas pendant le rendu. */
  followUp: { at: string; isDue: boolean; lateDays: number } | null;
  insight: { summary: string | null; objection: string | null } | null;
  offer: { formation: string | null; plan: string | null; promo: string | null; payments: string | null };
  recent: Recent[];
  back: { href: string; label: string };
  nav: { index: number; total: number; prevHref: string | null; nextHref: string | null } | null;
};

type Sheet = "none" | "move" | "lost" | "call" | "note" | "whatsapp" | "email";

const LOST_REASONS = ["Prix", "Dates", "Hors cible", "Ne répond plus", "A choisi ailleurs", "Autre"];
const DELAYS = [
  { days: 1, label: "Demain" },
  { days: 3, label: "3 jours" },
  { days: 7, label: "1 sem." },
  { days: 30, label: "1 mois" },
];
const QUICK_NOTES = ["Veut le programme", "Paiement en plusieurs fois", "Rappeler le soir", "En parle en famille"];

const DAY = 86400_000;

export function LeadMobileView({
  data,
  lead,
  bootcamp,
  templates,
  className,
}: {
  data: LeadMobileData;
  lead: Omit<Lead, "rawPayload">;
  bootcamp: Bootcamp | null;
  templates: EmailTemplate[];
  className?: string;
}) {
  const [sheet, setSheet] = useState<Sheet>("none");
  const [lostStatusId, setLostStatusId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const close = () => setSheet("none");
  const done = (message: string) => {
    setSheet("none");
    setToast(message);
  };

  function copy(value: string, what: string) {
    navigator.clipboard?.writeText(value).then(
      () => setToast(`${what} copié`),
      () => setToast("Copie impossible sur cet appareil")
    );
  }

  function snooze(days: number) {
    startTransition(async () => {
      const res = await setLeadFollowUpAction(data.id, days);
      setToast(res.message);
    });
  }

  function pickStage(s: Stage) {
    if (s.id === data.statusId) return close();
    // Même garde que l'en-tête bureau : on n'entre dans « Inscrit » que par
    // l'inscription, qui crée l'échéancier.
    if (s.kind === "converted") {
      close();
      if (bootcamp) setEnrolling(true);
      return;
    }
    if (s.kind === "lost") {
      setLostStatusId(s.id);
      setSheet("lost");
      return;
    }
    startTransition(async () => {
      await updateLeadStatusAction(data.id, s.id);
      done(`Déplacé vers « ${s.name} »`);
    });
  }

  const due = data.followUp ? new Date(data.followUp.at) : null;
  const lateDays = data.followUp?.lateDays ?? null;
  const isDue = data.followUp?.isDue ?? false;
  const qualif = QUALIFICATIONS.find((q) => q.value === data.qualification);
  const phone = data.mobile;
  const wa = data.whatsapp ?? data.mobile;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col bg-muted/30", className)}>
      {/* En-tête : retour, position dans la colonne, précédent / suivant */}
      <header className="flex shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-2">
        <Link
          href={data.back.href}
          aria-label={`Retour : ${data.back.label}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg hover:bg-muted"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12px] text-muted-foreground">
            {data.back.label}
            {data.statusName ? ` · ${data.statusName}` : ""}
          </span>
          {data.nav && data.nav.index >= 0 && (
            <span className="text-[13px] font-medium">
              {data.nav.index + 1} sur {data.nav.total}
            </span>
          )}
        </div>
        {data.nav && (
          <>
            <NavArrow href={data.nav.prevHref} label="Lead précédent" icon={ArrowUp01Icon} />
            <NavArrow href={data.nav.nextHref} label="Lead suivant" icon={ArrowDown01Icon} />
          </>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 pb-6 pt-3.5">
        {/* Qui */}
        <section className="space-y-2.5 px-0.5">
          <div className="flex items-center gap-3">
            <div className="grid h-13 w-13 shrink-0 place-items-center rounded-full bg-muted text-base font-semibold text-muted-foreground">
              {initials(data.fullName)}
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-[22px] font-semibold leading-tight">{data.fullName}</h1>
              <p className="text-[13px] text-muted-foreground">{data.origin}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSheet("move")}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-foreground bg-background px-3 text-[13.5px] font-semibold"
            >
              {data.statusName ?? "Sans étape"}
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
            </button>
            {isDue && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-medium text-amber-900">
                {lateDays && lateDays > 0 ? `Relance due · ${lateDays} j` : "Relance aujourd'hui"}
              </span>
            )}
            {qualif && (
              <span className={cn("rounded-full border px-2.5 py-1 text-[12px] font-medium", qualif.style)}>
                {qualif.label}
              </span>
            )}
          </div>
        </section>

        {/* Coordonnées, chacune actionnable */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <h2 className="px-3.5 pb-1 pt-3 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Coordonnées
          </h2>
          <ContactRow
            label="Téléphone"
            value={phone}
            action="Appeler"
            icon={Call02Icon}
            tone="bg-muted text-foreground"
            href={phone ? `tel:${phone.replace(/\s+/g, "")}` : undefined}
            onAction={() => setSheet("call")}
            onCopy={phone ? () => copy(phone, "Numéro") : undefined}
          />
          <ContactRow
            label="WhatsApp"
            value={wa}
            action="Écrire"
            icon={WhatsappIcon}
            tone="bg-green-50 text-green-800 border border-green-200"
            onAction={() => setSheet("whatsapp")}
            onCopy={wa ? () => copy(wa, "Numéro") : undefined}
          />
          <ContactRow
            label="Email"
            value={data.email}
            action="Écrire"
            icon={Mail01Icon}
            tone="bg-blue-50 text-blue-800 border border-blue-200"
            onAction={() => setSheet("email")}
            onCopy={data.email ? () => copy(data.email!, "Email") : undefined}
            last
          />
        </section>

        {/* Prochaine action */}
        <section
          className={cn(
            "space-y-2.5 rounded-2xl border p-3.5",
            isDue || !due ? "border-red-200 bg-red-50 text-red-950" : "border-border bg-card"
          )}
        >
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Clock01Icon} size={16} className={isDue || !due ? "text-red-600" : "text-muted-foreground"} />
            <h2 className={cn("text-[12px] font-medium uppercase tracking-wide", isDue || !due ? "text-red-700" : "text-muted-foreground")}>
              Prochaine action
            </h2>
          </div>
          <p className="text-[16px] font-semibold">
            {!due
              ? "Aucune relance posée"
              : isDue
                ? `Le rappeler — prévu le ${due.toLocaleDateString("fr-FR")}${lateDays && lateDays > 0 ? `, en retard de ${lateDays} j` : ""}`
                : `Le rappeler le ${due.toLocaleDateString("fr-FR")}`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSheet("call")}
              className="h-11 rounded-lg bg-red-600 text-[13.5px] font-semibold text-white"
            >
              Le faire
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => snooze(1)}
              className="h-11 rounded-lg border border-red-300 bg-background text-[13.5px] text-red-800 disabled:opacity-50"
            >
              Demain
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => snooze(3)}
              className="h-11 rounded-lg border border-red-300 bg-background text-[13.5px] text-red-800 disabled:opacity-50"
            >
              +3 jours
            </button>
          </div>
        </section>

        {/* Lecture IA */}
        {data.insight?.summary && (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-3.5">
            <h2 className="text-[12px] font-medium uppercase tracking-wide text-violet-700">En bref, lu par l&apos;IA</h2>
            <p className="text-[14.5px] leading-relaxed">{data.insight.summary}</p>
            {data.insight.objection && (
              <p className="text-[13.5px] text-amber-700">Frein : {data.insight.objection}</p>
            )}
          </section>
        )}

        {/* Formation et offre */}
        <section className="space-y-2 rounded-2xl border border-border bg-card p-3.5 text-[14px]">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Formation et offre</h2>
          <Line label="Formation" value={data.offer.formation} />
          <Line label="Offre" value={data.offer.plan} />
          <Line label="Code promo" value={data.offer.promo} />
          {data.offer.payments && <Line label="Paiements" value={data.offer.payments} />}
        </section>

        {/* Derniers échanges */}
        <section className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5">
          <h2 className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">Derniers échanges</h2>
          {data.recent.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Rien encore.</p>
          ) : (
            data.recent.map((r) => (
              <div key={r.id} className="flex gap-2.5 text-[13.5px]">
                <span className="w-14 shrink-0 text-muted-foreground">{shortDate(r.at)}</span>
                <span className="min-w-0 break-words">{r.label}</span>
              </div>
            ))
          )}
        </section>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed inset-x-3.5 bottom-[calc(92px+env(safe-area-inset-bottom,0px))] z-[55] flex items-center gap-2.5 rounded-xl bg-foreground px-3.5 py-3 text-[14px] text-background shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Les 4 gestes, sous le pouce */}
      <nav
        aria-label="Actions rapides"
        className="z-50 grid shrink-0 grid-cols-4 gap-2 border-t border-border bg-background px-3 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom,0px))]"
      >
        {phone ? (
          <a
            href={`tel:${phone.replace(/\s+/g, "")}`}
            onClick={() => setSheet("call")}
            className="flex h-15 flex-col items-center justify-center gap-1 rounded-2xl bg-primary text-[12.5px] font-medium text-primary-foreground"
          >
            <HugeiconsIcon icon={Call02Icon} size={20} />
            Appeler
          </a>
        ) : (
          <BarButton icon={Call02Icon} label="Appeler" onClick={() => setSheet("call")} className="bg-primary text-primary-foreground" />
        )}
        <BarButton
          icon={WhatsappIcon}
          label="WhatsApp"
          onClick={() => setSheet("whatsapp")}
          className="border border-green-200 bg-green-50 text-green-800"
        />
        <BarButton icon={Note02Icon} label="Note" onClick={() => setSheet("note")} className="border border-border bg-background" />
        <BarButton icon={ArrowRight02Icon} label="Déplacer" onClick={() => setSheet("move")} className="border border-border bg-background" />
      </nav>

      {sheet === "move" && (
        <BottomSheet title={`Déplacer ${firstName(data.fullName)} vers…`} onClose={close}>
          <div className="space-y-1.5">
            {data.statuses.map((s) => {
              const current = s.id === data.statusId;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => pickStage(s)}
                  className={cn(
                    "flex h-13 w-full items-center gap-3 rounded-xl border px-3.5 text-left disabled:opacity-50",
                    current ? "border-foreground bg-muted" : "border-border bg-background"
                  )}
                >
                  <span className="flex-1 text-[15px] font-medium">{s.name}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {current
                      ? "actuelle"
                      : s.kind === "converted"
                        ? "ouvre l'inscription"
                        : s.kind === "lost"
                          ? "raison demandée"
                          : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}

      {sheet === "lost" && lostStatusId && (
        <LostSheet
          pending={isPending}
          onClose={close}
          onConfirm={(reason, note) =>
            startTransition(async () => {
              const res = await markLeadLostAction(data.id, lostStatusId, reason, note);
              if (res.ok) done(res.message);
              else setToast(res.message);
            })
          }
        />
      )}

      {sheet === "call" && (
        <CallSheet
          phone={phone}
          pending={isPending}
          onClose={close}
          onSave={(input) =>
            startTransition(async () => {
              const res = await logCallOutcomeAction(data.id, input);
              if (res.ok) done(input.followUpDays != null ? `Appel noté · relance dans ${input.followUpDays} j` : "Appel noté");
              else setToast(res.message);
            })
          }
        />
      )}

      {sheet === "note" && (
        <NoteSheet
          pending={isPending}
          onClose={close}
          onSave={(content, days) =>
            startTransition(async () => {
              await addLeadNoteAction(data.id, content);
              if (days != null) await setLeadFollowUpAction(data.id, days);
              done(days != null ? `Note ajoutée · relance dans ${days} j` : "Note ajoutée");
            })
          }
        />
      )}

      {sheet === "whatsapp" && (
        <BottomSheet title="WhatsApp" onClose={close}>
          <WhatsAppComposer referenceType="lead" referenceId={data.id} to={wa ?? ""} onClose={close} />
        </BottomSheet>
      )}

      {sheet === "email" && (
        <BottomSheet title="Email" onClose={close}>
          <EmailComposer
            referenceType="lead"
            referenceId={data.id}
            to={data.email ?? ""}
            templates={templates}
            onClose={close}
          />
        </BottomSheet>
      )}

      {enrolling && bootcamp && (
        <EnrollLeadDialog lead={lead} bootcamp={bootcamp} onClose={() => setEnrolling(false)} />
      )}
    </div>
  );
}

// ── Morceaux ────────────────────────────────────────────

function NavArrow({ href, label, icon }: { href: string | null; label: string; icon: typeof ArrowUp01Icon }) {
  const cls = "grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-background";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>
      <HugeiconsIcon icon={icon} size={18} />
    </Link>
  ) : (
    <span aria-hidden="true" className={cn(cls, "opacity-30")}>
      <HugeiconsIcon icon={icon} size={18} />
    </span>
  );
}

function ContactRow({
  label,
  value,
  action,
  icon,
  tone,
  href,
  onAction,
  onCopy,
  last,
}: {
  label: string;
  value: string | null;
  action: string;
  icon: typeof Call02Icon;
  tone: string;
  href?: string;
  onAction: () => void;
  onCopy?: () => void;
  last?: boolean;
}) {
  const body = (
    <>
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}>
        <HugeiconsIcon icon={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <span className={cn("break-all text-[15px] font-medium", !value && "text-muted-foreground")}>
          {value ?? "non renseigné"}
        </span>
      </span>
      {value && <span className="shrink-0 text-[12.5px] font-semibold">{action}</span>}
    </>
  );
  const cls = "flex min-h-11 min-w-0 flex-1 items-center gap-3 py-0.5 text-left";
  return (
    <div className={cn("flex items-center gap-2.5 px-3 py-2.5", !last && "border-b border-border/60")}>
      {!value ? (
        <div className={cls}>{body}</div>
      ) : href ? (
        <a href={href} onClick={onAction} className={cls}>
          {body}
        </a>
      ) : (
        <button type="button" onClick={onAction} className={cls}>
          {body}
        </button>
      )}
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copier : ${label}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
        >
          <HugeiconsIcon icon={Copy01Icon} size={17} />
        </button>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function BarButton({
  icon,
  label,
  onClick,
  className,
}: {
  icon: typeof Call02Icon;
  label: string;
  onClick: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-15 flex-col items-center justify-center gap-1 rounded-2xl text-[12.5px] font-medium", className)}
    >
      <HugeiconsIcon icon={icon} size={20} />
      {label}
    </button>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/45">
      <button type="button" aria-label="Fermer" onClick={onClose} className="flex-1" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[88dvh] space-y-3 overflow-y-auto rounded-t-3xl bg-background px-4 pt-2 pb-[calc(20px+env(safe-area-inset-bottom,0px))]"
      >
        <div className="mx-auto my-1 h-1.5 w-10 rounded-full bg-border" />
        <h2 className="text-[18px] font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  cols,
  tone = "dark",
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  cols: 2 | 3 | 4;
  tone?: "dark" | "red";
}) {
  return (
    <div className={cn("grid gap-2", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4")}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.value)}
            className={cn(
              "h-12 rounded-xl border px-2 text-[14px] font-medium",
              on
                ? tone === "red"
                  ? "border-red-600 bg-red-50 text-red-800"
                  : "border-foreground bg-foreground text-background"
                : "border-border bg-background"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CallSheet({
  phone,
  pending,
  onClose,
  onSave,
}: {
  phone: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (input: {
    outcome: "answered" | "no_answer" | "wrong_number";
    qualification: string | null;
    followUpDays: number | null;
    note: string;
  }) => void;
}) {
  const [outcome, setOutcome] = useState<"answered" | "no_answer" | "wrong_number" | null>(null);
  const [qualification, setQualification] = useState<string | null>(null);
  // Toujours une relance par défaut : un appel noté sans suite laissait le
  // lead sortir de la file sans que personne ne le décide.
  const [days, setDays] = useState<number | null>(1);
  const [note, setNote] = useState("");

  return (
    <BottomSheet title="Comment s'est passé l'appel ?" onClose={onClose}>
      {phone && (
        <a
          href={`tel:${phone.replace(/\s+/g, "")}`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border text-[14px] font-medium"
        >
          <HugeiconsIcon icon={Call02Icon} size={17} />
          Composer le {phone}
        </a>
      )}
      <Chips
        cols={3}
        value={outcome}
        onChange={(v) => {
          setOutcome(v);
          if (v === "wrong_number") setDays(null);
        }}
        options={[
          { value: "answered", label: "Joint" },
          { value: "no_answer", label: "Pas répondu" },
          { value: "wrong_number", label: "Faux numéro" },
        ]}
      />
      {outcome === "answered" && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Où il en est</p>
          <Chips
            cols={3}
            value={qualification}
            onChange={setQualification}
            options={QUALIFICATIONS.map((q) => ({ value: q.value as string, label: q.label }))}
          />
        </div>
      )}
      {outcome !== "wrong_number" && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">Prochaine relance</p>
          <Chips cols={4} value={days} onChange={setDays} options={DELAYS.map((d) => ({ value: d.days, label: d.label }))} />
        </div>
      )}
      <label className="block space-y-1.5">
        <span className="text-[13px] font-semibold">Note (facultatif)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Ce qui s'est dit"
          className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-3 text-[15px] outline-none focus:border-ring"
        />
      </label>
      <button
        type="button"
        disabled={pending || !outcome}
        onClick={() => outcome && onSave({ outcome, qualification, followUpDays: outcome === "wrong_number" ? null : days, note })}
        className="h-13 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        {pending ? "Enregistrement…" : outcome ? "Enregistrer" : "Choisis ce qui s'est passé"}
      </button>
    </BottomSheet>
  );
}

function NoteSheet({
  pending,
  onClose,
  onSave,
}: {
  pending: boolean;
  onClose: () => void;
  onSave: (content: string, days: number | null) => void;
}) {
  const [content, setContent] = useState("");
  const [days, setDays] = useState<number | null>(null);

  return (
    <BottomSheet title="Ajouter une note" onClose={onClose}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Ce qu'il a dit, ce qu'il attend…"
        aria-label="Note"
        className="w-full resize-none rounded-xl border border-foreground bg-background px-3.5 py-3 text-[15px] outline-none"
      />
      <div className="flex flex-wrap gap-2">
        {QUICK_NOTES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setContent((c) => (c.trim() ? `${c.trim()} · ${q}` : q))}
            className="h-10 rounded-full border border-border bg-muted/40 px-3 text-[13px]"
          >
            {q}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[13px] font-semibold">Poser une relance ?</p>
        <Chips cols={4} value={days} onChange={setDays} options={DELAYS.map((d) => ({ value: d.days, label: d.label }))} />
      </div>
      <button
        type="button"
        disabled={pending || !content.trim()}
        onClick={() => onSave(content.trim(), days)}
        className="h-13 w-full rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40"
      >
        {pending ? "Enregistrement…" : "Enregistrer la note"}
      </button>
    </BottomSheet>
  );
}

function LostSheet({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <BottomSheet title="Pourquoi on le perd ?" onClose={onClose}>
      <p className="text-[13.5px] text-muted-foreground">
        Obligatoire : c&apos;est ce qui dira, plus tard, pourquoi on perd des inscrits.
      </p>
      <Chips cols={2} tone="red" value={reason} onChange={setReason} options={LOST_REASONS.map((r) => ({ value: r, label: r }))} />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Précision (facultatif)"
        aria-label="Précision"
        className="h-12 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] outline-none focus:border-ring"
      />
      <button
        type="button"
        disabled={pending || !reason}
        onClick={() => reason && onConfirm(reason, note)}
        className="h-13 w-full rounded-xl bg-red-700 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {pending ? "…" : "Passer en Perdu"}
      </button>
    </BottomSheet>
  );
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full;
}

function shortDate(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / DAY);
  if (days <= 0) return "auj.";
  if (days === 1) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
