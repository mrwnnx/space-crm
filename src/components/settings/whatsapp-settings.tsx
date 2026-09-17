"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { WhatsAppNumber, WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import {
  createQuickReplyAction,
  createTemplateAction,
  deleteQuickReplyAction,
  deleteTemplateAction,
  setAiReplyAction,
} from "@/app/whatsapp-actions";

/*
 * Paramètres → WhatsApp : le numéro tel que Meta le voit, l'interrupteur de la
 * réponse automatique, et les modèles — la seule chose qu'on peut envoyer à
 * quelqu'un qui n'a pas écrit depuis 24 h.
 */

const LABEL = "mb-1 block text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground";
const INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const LANGUES = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "Arabe" },
  { code: "en_US", label: "Anglais" },
];

type QuickReply = { id: string; shortcut: string; text: string };

export function WhatsAppSettings({
  numero,
  templates,
  aiReplyEnabled,
  quickReplies,
}: {
  numero: { ok: true; numero: WhatsAppNumber } | { ok: false; error: string };
  templates: WhatsAppTemplate[];
  aiReplyEnabled: boolean;
  quickReplies: QuickReply[];
}) {
  return (
    <div className="space-y-6">
      <SectionNumero numero={numero} />
      <SectionIA enabled={aiReplyEnabled} />
      <SectionReponsesRapides items={quickReplies} />
      <SectionModeles templates={templates} />
    </div>
  );
}

// ── Les réponses rapides ──────────────────────────────

function SectionReponsesRapides({ items }: { items: QuickReply[] }) {
  const router = useRouter();
  const [shortcut, setShortcut] = useState("");
  const [text, setText] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const r = await createQuickReplyAction(shortcut, text);
      if (r.ok) {
        setShortcut("");
        setText("");
        router.refresh();
      } else setErreur(r.error);
    });
  }

  function supprimer(id: string) {
    startTransition(async () => {
      await deleteQuickReplyAction(id);
      router.refresh();
    });
  }

  return (
    <Section title="Réponses rapides">
      <p className="mb-3 text-xs text-muted-foreground">
        Dans la page Messages, tapez <span className="font-mono">/</span> puis le raccourci : le texte se met en
        place, avec <span className="font-mono">{"{{firstName}}"}</span> et{" "}
        <span className="font-mono">{"{{formation}}"}</span> remplacés pour ce lead. Texte libre : ça ne part que
        dans la fenêtre de 24 h.
      </p>
      {items.length > 0 && (
        <ul className="mb-3 divide-y divide-border rounded-lg border border-border">
          {items.map((q) => (
            <li key={q.id} className="flex items-start gap-3 px-3 py-2">
              <span className="shrink-0 font-mono text-xs text-primary">/{q.shortcut}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-foreground">{q.text}</span>
              <button
                type="button"
                onClick={() => supprimer(q.id)}
                disabled={isPending}
                className="shrink-0 text-[10.5px] text-muted-foreground hover:text-red-600"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={ajouter} className="flex flex-wrap items-start gap-2">
        <label className="w-36">
          <span className={LABEL}>Raccourci</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-sm text-muted-foreground">/</span>
            <input
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="prix"
              className={cn(INPUT, "font-mono")}
              required
            />
          </div>
        </label>
        <label className="min-w-64 flex-1">
          <span className={LABEL}>Texte</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={"Bonjour {{firstName}}, le {{formation}} coûte 1300 TND, ou 3 × 500 TND."}
            className={cn(INPUT, "resize-y")}
            required
          />
        </label>
        <div className="flex flex-col items-end gap-1 self-end">
          <button
            type="submit"
            disabled={isPending || !shortcut || !text.trim()}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
        {erreur && <p className="w-full text-xs text-red-600">{erreur}</p>}
      </form>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">{title}</h2>
      {children}
    </section>
  );
}

// ── Le numéro ─────────────────────────────────────────

const QUALITE: Record<string, { label: string; cls: string }> = {
  GREEN: { label: "Bonne", cls: "bg-green-50 text-green-700" },
  YELLOW: { label: "Moyenne", cls: "bg-amber-50 text-amber-700" },
  RED: { label: "Mauvaise", cls: "bg-red-50 text-red-700" },
  UNKNOWN: { label: "Pas encore mesurée", cls: "bg-gray-50 text-gray-500" },
};

function SectionNumero({ numero }: { numero: { ok: true; numero: WhatsAppNumber } | { ok: false; error: string } }) {
  if (!numero.ok) {
    return (
      <Section title="Le numéro">
        <p className="text-xs text-red-600">{numero.error}</p>
      </Section>
    );
  }
  const n = numero.numero;
  const q = QUALITE[n.qualite ?? "UNKNOWN"] ?? QUALITE.UNKNOWN;
  const connecte = n.statut === "CONNECTED" && n.plateforme === "CLOUD_API";
  return (
    <Section title="Le numéro">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-lg font-semibold text-foreground">{n.numero}</span>
        {n.nom && <span className="text-sm text-muted-foreground">{n.nom}</span>}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            connecte ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          )}
        >
          {connecte ? "Connecté à l'API Cloud" : `${n.statut ?? "?"} · ${n.plateforme ?? "?"}`}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Qualité</dt>
          <dd>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", q.cls)}>{q.label}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Nom affiché</dt>
          <dd className="text-foreground">{n.nomVerifie === "APPROVED" ? "Approuvé" : (n.nomVerifie ?? "?")}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Débit</dt>
          <dd className="text-foreground">{n.debit ?? "?"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[10.5px] text-muted-foreground/70">
        La qualité, c&apos;est Meta qui la mesure sur les blocages et signalements des destinataires. Elle passe
        au rouge quand trop de gens bloquent le numéro — et Meta réduit alors le nombre d&apos;envois permis.
      </p>
    </Section>
  );
}

// ── L'IA ──────────────────────────────────────────────

function SectionIA({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [isPending, startTransition] = useTransition();

  function basculer(v: boolean) {
    setOn(v);
    startTransition(async () => {
      await setAiReplyAction(v);
      router.refresh();
    });
  }

  return (
    <Section title="Réponse automatique par IA">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={isPending}
          onChange={(e) => basculer(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span>
          <span className="block text-sm font-medium text-foreground">
            {on ? "Activée" : "Désactivée"}
          </span>
          <span className="block text-xs text-muted-foreground">
            Quand elle sera livrée, l&apos;IA répondra aux messages reçus à partir des formations du CRM et des
            réponses que vous aurez rédigées. Ce réglage est lu par elle — pour l&apos;instant, personne ne répond à
            votre place.
          </span>
        </span>
      </label>
    </Section>
  );
}

// ── Les modèles ───────────────────────────────────────

const STATUT: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Approuvé", cls: "bg-green-50 text-green-700" },
  PENDING: { label: "En attente", cls: "bg-amber-50 text-amber-700" },
  IN_APPEAL: { label: "En appel", cls: "bg-amber-50 text-amber-700" },
  REJECTED: { label: "Refusé", cls: "bg-red-50 text-red-700" },
  PAUSED: { label: "En pause", cls: "bg-red-50 text-red-700" },
  DISABLED: { label: "Désactivé", cls: "bg-gray-50 text-gray-500" },
};

function SectionModeles({ templates }: { templates: WhatsAppTemplate[] }) {
  return (
    <Section title="Modèles de message">
      <p className="mb-4 text-xs text-muted-foreground">
        Le seul message qu&apos;on peut envoyer à quelqu&apos;un qui n&apos;a pas écrit depuis 24 h. Chaque modèle est relu
        par Meta — de quelques minutes à 48 h — avant de pouvoir partir.
      </p>

      {templates.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun modèle sur le compte.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {templates.map((t) => (
            <LigneModele key={t.id} t={t} />
          ))}
        </ul>
      )}

      <NouveauModele existants={templates.map((t) => t.name)} />
    </Section>
  );
}

function LigneModele({ t }: { t: WhatsAppTemplate }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const s = STATUT[t.status] ?? { label: t.status, cls: "bg-gray-50 text-gray-500" };

  function supprimer() {
    startTransition(async () => {
      const r = await deleteTemplateAction(t.name);
      if (r.ok) router.refresh();
      else setErreur(r.error);
    });
  }

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-medium text-foreground">{t.name}</span>
        <span className="text-[10.5px] text-muted-foreground">
          {LANGUES.find((l) => l.code === t.language)?.label ?? t.language} · {t.category.toLowerCase()}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", s.cls)}>{s.label}</span>
        <span className="flex-1" />
        {confirme ? (
          <>
            <button
              type="button"
              onClick={supprimer}
              disabled={isPending}
              className="text-[10.5px] font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              {isPending ? "…" : "Confirmer la suppression"}
            </button>
            <button type="button" onClick={() => setConfirme(false)} className="text-[10.5px] text-muted-foreground hover:underline">
              Annuler
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirme(true)} className="text-[10.5px] text-muted-foreground hover:text-red-600 hover:underline">
            Supprimer
          </button>
        )}
      </div>
      {t.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>}
      {t.rejectedReason && <p className="mt-1 text-[10.5px] text-red-600">Motif de Meta : {t.rejectedReason}</p>}
      {erreur && <p className="mt-1 text-[10.5px] text-red-600">{erreur}</p>}
    </li>
  );
}

function compterVariables(body: string): number {
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

function NouveauModele({ existants }: { existants: string[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("fr");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const n = compterVariables(body);
  const nomPris = existants.includes(name.trim().toLowerCase());

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await createTemplateAction({ name, language, category, body, examples });
      if (r.ok) {
        setMessage({ ok: true, texte: "Soumis à Meta. Il apparaît « en attente » jusqu'à sa relecture." });
        setName("");
        setBody("");
        setExamples([]);
        router.refresh();
      } else {
        setMessage({ ok: false, texte: r.error });
      }
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="mt-4 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Nouveau modèle
      </button>
    );
  }

  return (
    <form onSubmit={soumettre} className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={LABEL}>Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            placeholder="relance_brochure"
            className={cn(INPUT, "font-mono")}
            required
          />
          {nomPris && <span className="text-[10.5px] text-red-600">Ce nom existe déjà.</span>}
        </label>
        <label>
          <span className={LABEL}>Langue</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={INPUT}>
            {LANGUES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>Catégorie</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "MARKETING" | "UTILITY")}
            className={INPUT}
          >
            <option value="MARKETING">Marketing — relance, promotion</option>
            <option value="UTILITY">Utilitaire — rappel, confirmation</option>
          </select>
        </label>
      </div>

      <label>
        <span className={LABEL}>Message</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={1024}
          placeholder={"Bonjour {{1}}, vous avez demandé la brochure de {{2}}. On vous appelle quand ?"}
          className={cn(INPUT, "resize-y")}
          required
        />
        <span className="text-[10.5px] text-muted-foreground">
          {"{{1}}"}, {"{{2}}"}… sont les variables, remplies à l&apos;envoi. {body.length}/1024
        </span>
      </label>

      {n > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: n }, (_, i) => (
            <label key={i}>
              <span className={LABEL}>Exemple pour {`{{${i + 1}}}`}</span>
              <input
                value={examples[i] ?? ""}
                onChange={(e) => {
                  const v = [...examples];
                  v[i] = e.target.value;
                  setExamples(v);
                }}
                placeholder={i === 0 ? "Sara" : "UX/UI Bootcamp"}
                className={INPUT}
                required
              />
            </label>
          ))}
          <p className="text-[10.5px] text-muted-foreground sm:col-span-2">
            Meta relit le message avec ces exemples à la place des variables.
          </p>
        </div>
      )}

      {message && (
        <p className={cn("text-xs", message.ok ? "text-green-700" : "text-red-600")}>{message.texte}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          Fermer
        </button>
        <button
          type="submit"
          disabled={isPending || nomPris || !name || !body.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {isPending ? "Envoi à Meta…" : "Soumettre à Meta"}
        </button>
      </div>
    </form>
  );
}
