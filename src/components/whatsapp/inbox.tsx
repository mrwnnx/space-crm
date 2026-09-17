"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, Attachment01Icon, Mic01Icon, WhatsappIcon } from "@hugeicons/core-free-icons";
import { cn, formatRelative, initials } from "@/lib/utils";
import { actorName } from "@/lib/actors";
import type { WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import {
  assignBootcampAction,
  markWhatsAppReadAction,
  reactWhatsAppAction,
  replyWhatsAppAction,
  replyWhatsAppTemplateAction,
  sendWhatsAppMediaAction,
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
  status: "sent" | "delivered" | "read" | "failed" | "received" | null;
  error: string | null;
  media: { kind: "image" | "video" | "audio" | "document" | "sticker"; url: string; mimeType: string | null; filename: string | null } | null;
  wamid: string | null;
  replyTo: { content: string | null; direction: "inbound" | "outbound" } | null;
  reactionLead: string | null;
  reactionUs: string | null;
};

type QuickReply = { shortcut: string; text: string };

/** Ce que la zone de réponse cite : posé par « Répondre » sur une bulle. */
type Citation = { wamid: string; content: string | null; direction: "inbound" | "outbound" };

const EMOJIS = ["👍", "❤️", "😂", "🙏", "👏", "✅"];

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
  quickReplies,
}: {
  conversations: Conversation[];
  thread: Thread | null;
  templates: WhatsAppTemplate[];
  bootcamps: Bootcamp[];
  quickReplies: QuickReply[];
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
          <ThreadView
            key={thread.lead.id} // un autre lead = un autre fil : citation et brouillon repartent de zéro
            thread={thread}
            templates={templates}
            bootcamps={bootcamps}
            quickReplies={quickReplies}
          />
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
  quickReplies,
}: {
  thread: Thread;
  templates: WhatsAppTemplate[];
  bootcamps: Bootcamp[];
  quickReplies: QuickReply[];
}) {
  const router = useRouter();
  const { lead, messages, lastInboundAt, ouverte } = thread;
  const bas = useRef<HTMLDivElement>(null);
  const [citation, setCitation] = useState<Citation | null>(null);

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
            <Bulle
              key={m.id}
              m={m}
              precedent={messages[i - 1]}
              actif={ouverte && !!lead.mobileNo}
              onRepondre={() => m.wamid && setCitation({ wamid: m.wamid, content: m.content, direction: m.direction })}
              onReagir={(emoji) =>
                m.wamid && lead.mobileNo ? reactWhatsAppAction(lead.id, lead.mobileNo, m.wamid, emoji).then(() => router.refresh()) : undefined
              }
            />
          ))}
          <div ref={bas} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="mx-auto max-w-2xl">
          {!lead.mobileNo ? (
            <p className="text-xs text-muted-foreground">Ce lead n&apos;a pas de numéro : impossible de répondre.</p>
          ) : ouverte ? (
            <ReponseLibre
              leadId={lead.id}
              to={lead.mobileNo}
              prenom={lead.fullName.split(" ")[0]}
              formation={lead.bootcamp?.split(" · ")[0] ?? ""}
              quickReplies={quickReplies}
              citation={citation}
              onCitationClear={() => setCitation(null)}
            />
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

function Bulle({
  m,
  precedent,
  actif,
  onRepondre,
  onReagir,
}: {
  m: Message;
  precedent?: Message;
  actif: boolean; // fenêtre ouverte : on peut citer et réagir
  onRepondre: () => void;
  onReagir: (emoji: string) => void;
}) {
  const d = new Date(m.createdAt);
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const nouveauJour = !precedent || new Date(precedent.createdAt).toDateString() !== d.toDateString();
  const sortant = m.direction === "outbound";
  const [picker, setPicker] = useState(false);
  // Sans wamid (message d'avant les lots A/D), ni citation ni réaction possibles.
  const outils = actif && !!m.wamid;
  const reactions = [m.reactionLead, m.reactionUs].filter(Boolean) as string[];

  return (
    <>
      {nouveauJour && (
        <p className="my-2 text-center text-[10.5px] uppercase tracking-wider text-muted-foreground">{jour}</p>
      )}
      <div className={cn("group flex items-end gap-1", sortant ? "justify-end" : "justify-start")}>
        {sortant && outils && (
          <OutilsBulle m={m} picker={picker} setPicker={setPicker} onRepondre={onRepondre} onReagir={onReagir} />
        )}
        <div className="relative max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
            sortant ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground"
          )}
        >
          {m.replyTo && (
            <div
              className={cn(
                "mb-1.5 border-l-2 pl-2 text-xs opacity-80",
                sortant ? "border-primary-foreground/60" : "border-primary"
              )}
            >
              <span className="block text-[10px] font-medium">{m.replyTo.direction === "outbound" ? "Vous" : "Le lead"}</span>
              <span className="line-clamp-2">{m.replyTo.content}</span>
            </div>
          )}
          {m.media && <PieceJointe media={m.media} sortant={sortant} />}
          {/* Sans légende, le texte n'est que le libellé « 📷 Photo » : le média suffit. */}
          {!(m.media && m.media.kind !== "document" && /^(📷|🎥|🎤|Sticker)/.test(m.content ?? "")) && m.content}
          <p className={cn("mt-1 text-right text-[10px]", sortant ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {sortant && m.createdBy ? `${actorName(m.createdBy)} · ` : ""}
            {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {sortant && <Accuse status={m.status} />}
          </p>
        </div>
        {reactions.length > 0 && (
          <span
            className={cn(
              "absolute -bottom-2 rounded-full border border-border bg-background px-1.5 text-xs leading-5 shadow-sm",
              sortant ? "left-1" : "right-1"
            )}
            title={[m.reactionLead && `Le lead : ${m.reactionLead}`, m.reactionUs && `Vous : ${m.reactionUs}`].filter(Boolean).join(" · ")}
          >
            {reactions.join("")}
          </span>
        )}
        </div>
        {!sortant && outils && (
          <OutilsBulle m={m} picker={picker} setPicker={setPicker} onRepondre={onRepondre} onReagir={onReagir} />
        )}
      </div>
      {sortant && m.status === "failed" && (
        <p className="-mt-0.5 text-right text-[10.5px] text-red-600">{m.error ?? "Échec de l'envoi."}</p>
      )}
    </>
  );
}

/** « Répondre » et le choix d'un emoji, visibles au survol de la bulle. */
function OutilsBulle({
  m,
  picker,
  setPicker,
  onRepondre,
  onReagir,
}: {
  m: Message;
  picker: boolean;
  setPicker: (v: boolean) => void;
  onRepondre: () => void;
  onReagir: (emoji: string) => void;
}) {
  return (
    <div className="relative mb-4 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={onRepondre}
        className="rounded px-1 text-[10.5px] text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Répondre à ce message"
      >
        ↩
      </button>
      <button
        type="button"
        onClick={() => setPicker(!picker)}
        className="rounded px-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Réagir"
      >
        {m.reactionUs ?? "☺"}
      </button>
      {picker && (
        <div className="absolute bottom-6 z-10 flex gap-0.5 rounded-full border border-border bg-background px-1.5 py-1 shadow-md">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setPicker(false);
                // Recliquer l'emoji déjà posé le retire.
                onReagir(m.reactionUs === e ? "" : e);
              }}
              className={cn("rounded-full px-1 text-base hover:bg-muted", m.reactionUs === e && "bg-muted")}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PieceJointe({ media, sortant }: { media: NonNullable<Message["media"]>; sortant: boolean }) {
  switch (media.kind) {
    case "image":
    case "sticker":
      return (
        <a href={media.url} target="_blank" rel="noreferrer" className="mb-1 block">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL externe du bucket, taille inconnue */}
          <img
            src={media.url}
            alt=""
            className={cn("rounded-lg object-cover", media.kind === "sticker" ? "h-28 w-28" : "max-h-72 w-full max-w-xs")}
          />
        </a>
      );
    case "video":
      return <video src={media.url} controls preload="metadata" className="mb-1 max-h-72 w-full max-w-xs rounded-lg" />;
    case "audio":
      return <audio src={media.url} controls preload="metadata" className="mb-1 w-64 max-w-full" />;
    case "document":
      return (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className={cn("mb-1 block underline underline-offset-2", sortant ? "text-primary-foreground" : "text-primary")}
        >
          📄 {media.filename ?? "Document"}
        </a>
      );
  }
}

/**
 * Enregistrer un vocal dans le navigateur, directement en ogg/opus — le seul
 * format que WhatsApp affiche comme un message vocal. Chrome n'enregistre
 * qu'en webm : l'encodeur (opus-recorder, wasm) tourne dans un worker servi
 * depuis /opus/. Le résultat devient un File, envoyé comme une pièce jointe.
 */
function useVocal(onFichier: (f: File) => void, onErreur: (e: string) => void) {
  const [enregistre, setEnregistre] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const rec = useRef<{ stop: () => void; close: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  async function demarrer() {
    try {
      const { default: Recorder } = await import("opus-recorder");
      const r = new Recorder({
        encoderPath: "/opus/encoderWorker.min.js",
        encoderApplication: 2048, // voix
        encoderSampleRate: 48000,
        encoderBitRate: 32000,
        numberOfChannels: 1,
      });
      const morceaux: Uint8Array[] = [];
      r.ondataavailable = (data) => morceaux.push(data);
      r.onstop = () => {
        const blob = new Blob(morceaux as BlobPart[], { type: "audio/ogg" });
        onFichier(new File([blob], `vocal-${Date.now()}.ogg`, { type: "audio/ogg" }));
        r.close();
        rec.current = null;
      };
      await r.start();
      rec.current = r;
      setSecondes(0);
      setEnregistre(true);
      timer.current = setInterval(() => setSecondes((n) => n + 1), 1000);
    } catch (e) {
      onErreur(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Micro refusé par le navigateur — autorisez-le pour ce site."
          : "Impossible de démarrer l'enregistrement."
      );
    }
  }

  function arreter() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setEnregistre(false);
    rec.current?.stop();
  }

  const duree = `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
  return { enregistre, duree, demarrer, arreter };
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

function ReponseLibre({
  leadId,
  to,
  prenom,
  formation,
  quickReplies,
  citation,
  onCitationClear,
}: {
  leadId: string;
  to: string;
  prenom: string;
  formation: string;
  quickReplies: QuickReply[];
  citation: Citation | null;
  onCitationClear: () => void;
}) {
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const zone = useRef<HTMLTextAreaElement>(null);
  // « / » en début de message ouvre la liste des réponses rapides, filtrée par ce qui suit.
  const filtre = texte.startsWith("/") && !texte.includes("\n") ? texte.slice(1).toLowerCase() : null;
  const suggestions = filtre === null ? [] : quickReplies.filter((q) => q.shortcut.startsWith(filtre)).slice(0, 6);
  function inserer(q: QuickReply) {
    // Les variables du texte prêt prennent les valeurs de CE lead.
    setTexte(q.text.replace(/\{\{firstName\}\}/g, prenom).replace(/\{\{formation\}\}/g, formation));
    zone.current?.focus();
  }
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const vocal = useVocal((f) => setFichier(f), (e) => setErreur(e));
  const estVocal = fichier?.type === "audio/ogg";
  // Une URL d'aperçu par vocal, libérée quand il change — pas une par rendu.
  const apercu = useMemo(() => (estVocal && fichier ? URL.createObjectURL(fichier) : null), [fichier, estVocal]);
  useEffect(() => () => {
    if (apercu) URL.revokeObjectURL(apercu);
  }, [apercu]);

  function envoyer() {
    if ((!texte.trim() && !fichier) || isPending) return;
    setErreur(null);
    startTransition(async () => {
      let r: { ok: true } | { ok: false; error: string };
      if (fichier) {
        // Avec une pièce jointe, le texte devient sa légende.
        const fd = new FormData();
        fd.set("leadId", leadId);
        fd.set("to", to);
        fd.set("caption", texte);
        fd.set("file", fichier);
        if (citation) fd.set("replyTo", citation.wamid);
        r = await sendWhatsAppMediaAction(fd);
      } else {
        r = await replyWhatsAppAction(leadId, to, texte, citation?.wamid ?? null);
      }
      if (r.ok) {
        setTexte("");
        setFichier(null);
        onCitationClear();
        if (fileRef.current) fileRef.current.value = "";
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
      {citation && (
        <div className="mb-1.5 flex items-start gap-2 rounded-lg border-l-2 border-primary bg-muted px-2.5 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium text-muted-foreground">
              En réponse à {citation.direction === "outbound" ? "vous" : "le lead"}
            </span>
            <span className="line-clamp-2 text-foreground">{citation.content}</span>
          </div>
          <button type="button" onClick={onCitationClear} className="text-muted-foreground hover:text-foreground" aria-label="Retirer la citation">
            ✕
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="mb-1.5 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          {suggestions.map((q) => (
            <button
              key={q.shortcut}
              type="button"
              onClick={() => inserer(q)}
              className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-muted"
            >
              <span className="shrink-0 font-mono text-xs text-primary">/{q.shortcut}</span>
              <span className="truncate text-xs text-muted-foreground">{q.text}</span>
            </button>
          ))}
        </div>
      )}
      {filtre !== null && suggestions.length === 0 && quickReplies.length === 0 && (
        <p className="mb-1.5 text-[10.5px] text-muted-foreground">
          Aucune réponse rapide — créez-en dans Paramètres → WhatsApp.
        </p>
      )}
      <textarea
        ref={zone}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) envoyer();
          // Entrée ou Tab sur une suggestion unique l'insère.
          if ((e.key === "Enter" || e.key === "Tab") && suggestions.length === 1 && filtre !== null) {
            e.preventDefault();
            inserer(suggestions[0]);
          }
        }}
        placeholder={estVocal ? "Le vocal part sans texte." : fichier ? "Légende (facultative)…" : "Votre réponse… (« / » pour une réponse rapide)"}
        disabled={estVocal}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,video/mp4,application/pdf"
            className="hidden"
            onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
          />
          {vocal.enregistre ? (
            <button
              type="button"
              onClick={vocal.arreter}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10.5px] font-medium text-white"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              {vocal.duree} · Arrêter
            </button>
          ) : (
            <button
              type="button"
              onClick={vocal.demarrer}
              disabled={isPending || !!fichier}
              className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground disabled:opacity-40"
              title="Enregistrer un vocal"
            >
              <HugeiconsIcon icon={Mic01Icon} size={14} />
              Vocal
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={vocal.enregistre}
            className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            title="Photo, vidéo ou PDF — 4 Mo max"
          >
            <HugeiconsIcon icon={Attachment01Icon} size={14} />
            {fichier && !estVocal ? (
              <span className="max-w-48 truncate text-foreground">{fichier.name}</span>
            ) : (
              "Joindre"
            )}
          </button>
          {apercu && <audio src={apercu} controls className="h-7 w-44" />}
          {fichier && (
            <button
              type="button"
              onClick={() => {
                setFichier(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="text-[10.5px] text-muted-foreground hover:text-red-600"
            >
              ✕
            </button>
          )}
          <p className="truncate text-[10.5px] text-muted-foreground">{erreur ?? (fichier ? "" : "⌘↵ pour envoyer")}</p>
        </div>
        <button
          type="submit"
          disabled={isPending || (!texte.trim() && !fichier)}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
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
