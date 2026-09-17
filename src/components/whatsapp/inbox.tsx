"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { cn, formatRelative, initials } from "@/lib/utils";
import { actorName } from "@/lib/actors";
import type { WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import {
  assignBootcampAction,
  markWhatsAppReadAction,
  replyWhatsAppAction,
  replyWhatsAppTemplateAction,
} from "@/app/whatsapp-actions";

/*
 * La boîte WhatsApp : conversations à gauche, le fil à droite.
 *
 * Pas de temps réel : la page se rafraîchit toutes les 10 s, ce qui suffit à
 * une équipe de deux personnes et n'exige aucun serveur de plus. Les données
 * viennent du serveur à chaque rafraîchissement ; ce composant ne garde en
 * mémoire que ce qui est en train d'être tapé.
 */

const RAFRAICHISSEMENT_MS = 10_000;

type Conversation = {
  leadId: string;
  fullName: string;
  mobileNo: string | null;
  bootcamp: string | null;
  lastAt: string;
  lastDirection: "inbound" | "outbound";
  lastContent: string | null;
  lastInboundAt: string | null;
  unread: number;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  content: string | null;
  createdBy: string | null;
  createdAt: string;
  status: "sent" | "delivered" | "read" | "failed" | null;
  error: string | null;
};

type Thread = {
  lead: { id: string; fullName: string; mobileNo: string | null; email: string | null; bootcamp: string | null };
  messages: Message[];
  lastInboundAt: string | null;
  ouverte: boolean; // fenêtre de 24 h ouverte — décidé côté serveur, à l'heure du serveur
};

type Bootcamp = { id: string; name: string };

export function WhatsAppInbox({
  conversations,
  thread,
  templates,
  bootcamps,
}: {
  conversations: Conversation[];
  thread: Thread | null;
  templates: WhatsAppTemplate[];
  bootcamps: Bootcamp[];
}) {
  const router = useRouter();

  useEffect(() => {
    const t = setInterval(() => router.refresh(), RAFRAICHISSEMENT_MS);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside
        className={cn(
          "w-full shrink-0 flex-col overflow-y-auto border-r border-border bg-card md:flex md:w-80",
          thread ? "hidden" : "flex"
        )}
      >
        {conversations.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Aucune conversation pour l&apos;instant. Elles apparaîtront ici dès qu&apos;un message
            arrive sur le numéro de l&apos;école.
          </p>
        ) : (
          conversations.map((c) => (
            <ConversationRow key={c.leadId} c={c} active={thread?.lead.id === c.leadId} />
          ))
        )}
      </aside>

      <section className={cn("flex-1 flex-col overflow-hidden", thread ? "flex" : "hidden md:flex")}>
        {thread ? (
          <ThreadView thread={thread} templates={templates} bootcamps={bootcamps} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <HugeiconsIcon icon={WhatsappIcon} size={28} />
            <p className="text-sm">Choisissez une conversation.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ConversationRow({ c, active }: { c: Conversation; active: boolean }) {
  const apercu = c.lastContent ?? "";
  return (
    <Link
      href={`/whatsapp?lead=${c.leadId}`}
      className={cn(
        "flex gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted",
        active && "bg-primary/10"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {initials(c.fullName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-sm text-foreground", c.unread > 0 ? "font-semibold" : "font-medium")}>
            {c.fullName}
          </p>
          <span className="shrink-0 text-[10.5px] text-muted-foreground">{formatRelative(c.lastAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-xs", c.unread > 0 ? "text-foreground" : "text-muted-foreground")}>
            {c.lastDirection === "outbound" && <span className="text-muted-foreground">Vous : </span>}
            {apercu}
          </p>
          {c.unread > 0 && (
            <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {c.unread}
            </span>
          )}
        </div>
        {c.bootcamp && <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{c.bootcamp}</p>}
      </div>
    </Link>
  );
}

function ThreadView({
  thread,
  templates,
  bootcamps,
}: {
  thread: Thread;
  templates: WhatsAppTemplate[];
  bootcamps: Bootcamp[];
}) {
  const router = useRouter();
  const { lead, messages, lastInboundAt, ouverte } = thread;
  const bas = useRef<HTMLDivElement>(null);

  // Ouvrir la conversation, c'est la lire — pour toute l'équipe. Redéclenché
  // quand un nouveau message arrive pendant qu'elle est ouverte.
  useEffect(() => {
    markWhatsAppReadAction(lead.id).then(() => router.refresh());
  }, [lead.id, lastInboundAt, router]);

  useEffect(() => {
    bas.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lead.id]);

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link href="/whatsapp" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Retour">
          <HugeiconsIcon icon={ArrowLeft01Icon} size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{lead.fullName}</p>
          <p className="truncate text-[10.5px] text-muted-foreground">
            {lead.mobileNo ?? "sans numéro"}
            {lead.bootcamp ? ` · ${lead.bootcamp}` : " · aucune formation"}
          </p>
        </div>
        {!lead.bootcamp && <AttribuerFormation leadId={lead.id} bootcamps={bootcamps} />}
        <Link href={`/leads/${lead.id}`} className="shrink-0 text-xs text-primary hover:underline">
          Voir la fiche
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          {messages.map((m, i) => (
            <Bulle key={m.id} m={m} precedent={messages[i - 1]} />
          ))}
          <div ref={bas} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="mx-auto max-w-2xl">
          {!lead.mobileNo ? (
            <p className="text-xs text-muted-foreground">Ce lead n&apos;a pas de numéro : impossible de répondre.</p>
          ) : ouverte ? (
            <ReponseLibre leadId={lead.id} to={lead.mobileNo} />
          ) : (
            <ReponseModele leadId={lead.id} to={lead.mobileNo} templates={templates} />
          )}
        </div>
      </div>
    </>
  );
}

/** Un lead né d'un WhatsApp n'a pas de formation : on la lui donne ici, sans quitter le fil. */
function AttribuerFormation({ leadId, bootcamps }: { leadId: string; bootcamps: Bootcamp[] }) {
  const router = useRouter();
  const [bootcampId, setBootcampId] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function attribuer() {
    if (!bootcampId || isPending) return;
    setErreur(null);
    startTransition(async () => {
      const r = await assignBootcampAction(leadId, bootcampId);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <select
        value={bootcampId}
        onChange={(e) => setBootcampId(e.target.value)}
        className="max-w-44 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
        title={erreur ?? undefined}
      >
        <option value="">Attribuer une formation…</option>
        {bootcamps.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={attribuer}
        disabled={!bootcampId || isPending}
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-40"
      >
        {isPending ? "…" : "OK"}
      </button>
      {erreur && <span className="text-[10.5px] text-red-600">{erreur}</span>}
    </div>
  );
}

function Bulle({ m, precedent }: { m: Message; precedent?: Message }) {
  const d = new Date(m.createdAt);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const nouveauJour = !precedent || new Date(precedent.createdAt).toDateString() !== d.toDateString();
  const sortant = m.direction === "outbound";

  return (
    <>
      {nouveauJour && (
        <p className="my-2 text-center text-[10.5px] uppercase tracking-wider text-muted-foreground">{jour}</p>
      )}
      <div className={cn("flex", sortant ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
            sortant ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
          )}
        >
          {m.content}
          <p className={cn("mt-1 text-right text-[10px]", sortant ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {sortant && m.createdBy ? `${actorName(m.createdBy)} · ` : ""}
            {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {sortant && <Accuse status={m.status} />}
          </p>
        </div>
      </div>
      {sortant && m.status === "failed" && (
        <p className="-mt-0.5 text-right text-[10.5px] text-red-600">{m.error ?? "Échec de l'envoi."}</p>
      )}
    </>
  );
}

/** Les coches de WhatsApp : ✓ envoyé, ✓✓ livré, ✓✓ bleues lu, ! échec. Rien = statut inconnu. */
function Accuse({ status }: { status: Message["status"] }) {
  if (!status) return null;
  if (status === "failed") return <span className="ml-1 font-semibold text-red-300" title="Échec">!</span>;
  return (
    <span
      className={cn("ml-1", status === "read" ? "text-sky-300" : "text-primary-foreground/70")}
      title={status === "read" ? "Lu" : status === "delivered" ? "Livré" : "Envoyé"}
    >
      {status === "sent" ? "✓" : "✓✓"}
    </span>
  );
}

function ReponseLibre({ leadId, to }: { leadId: string; to: string }) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function envoyer() {
    if (!texte.trim() || isPending) return;
    setErreur(null);
    startTransition(async () => {
      const r = await replyWhatsAppAction(leadId, to, texte);
      if (r.ok) {
        setTexte("");
        router.refresh();
      } else {
        setErreur(r.error);
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        envoyer();
      }}
    >
      <textarea
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) envoyer();
        }}
        placeholder="Votre réponse…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-muted-foreground">{erreur ?? "⌘↵ pour envoyer"}</p>
        <button
          type="submit"
          disabled={isPending || !texte.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {isPending ? "Envoi…" : "Envoyer"}
        </button>
      </div>
    </form>
  );
}

function ReponseModele({ leadId, to, templates }: { leadId: string; to: string; templates: WhatsAppTemplate[] }) {
  const router = useRouter();
  const [nom, setNom] = useState(templates[0]?.name ?? "");
  const [variables, setVariables] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const modele = templates.find((t) => t.name === nom) ?? null;

  function envoyer() {
    if (!modele || isPending) return;
    setErreur(null);
    startTransition(async () => {
      const r = await replyWhatsAppTemplateAction(
        leadId,
        to,
        { name: modele.name, language: modele.language, body: modele.body },
        Array.from({ length: modele.variables }, (_, i) => variables[i] ?? "")
      );
      if (r.ok) {
        setVariables([]);
        router.refresh();
      } else {
        setErreur(r.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Cette personne n&apos;a pas écrit depuis plus de 24 h : Meta n&apos;accepte qu&apos;un{" "}
        <strong className="font-medium text-foreground">modèle approuvé</strong>. Dès qu&apos;elle
        répond, vous pourrez écrire librement.
      </p>
      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucun modèle approuvé sur le compte pour l&apos;instant.
        </p>
      ) : (
        <>
          <select
            value={nom}
            onChange={(e) => {
              setNom(e.target.value);
              setVariables([]);
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          >
            {templates.map((t) => (
              <option key={`${t.name}-${t.language}`} value={t.name}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
          {modele?.body && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs whitespace-pre-wrap text-foreground">{modele.body}</p>
          )}
          {modele &&
            Array.from({ length: modele.variables }, (_, i) => (
              <input
                key={i}
                value={variables[i] ?? ""}
                onChange={(e) => {
                  const v = [...variables];
                  v[i] = e.target.value;
                  setVariables(v);
                }}
                placeholder={`Valeur de {{${i + 1}}}`}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              />
            ))}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] text-red-600">{erreur}</p>
            <button
              type="button"
              onClick={envoyer}
              disabled={isPending || !modele}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {isPending ? "Envoi…" : "Envoyer le modèle"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
