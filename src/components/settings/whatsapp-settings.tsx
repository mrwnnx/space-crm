"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { WhatsAppNumber, WhatsAppProfile, WhatsAppTemplate } from "@/lib/messaging/whatsapp";
import { WHATSAPP_VERTICALS } from "@/lib/messaging/whatsapp-verticals";
import {
  createQuickReplyAction,
  createTemplateAction,
  deleteQuickReplyAction,
  deleteTemplateAction,
  editTemplateAction,
  reviewTemplateAction,
  saveAutoRepliesAction,
  saveButtonActionAction,
  setAiReplyAction,
  updateProfileAction,
} from "@/app/whatsapp-actions";

/*
 * Paramètres → WhatsApp : le numéro tel que Meta le voit, l'interrupteur de la
 * réponse automatique, et les modèles — la seule chose qu'on peut envoyer à
 * quelqu'un qui n'a pas écrit depuis 24 h.
 */

const LABEL = "mb-1 block text-[12.5px] font-medium uppercase tracking-wider text-muted-foreground";
const INPUT =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const LANGUES = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "Arabe" },
  { code: "en_US", label: "Anglais" },
];

type QuickReply = { id: string; shortcut: string; text: string };

export type AutoReplies = {
  welcomeEnabled: boolean;
  welcomeText: string;
  awayEnabled: boolean;
  awayText: string;
  awayStart: number;
  awayEnd: number;
  awayDays: number[];
};

export function WhatsAppSettings({
  numero,
  profil,
  templates,
  aiReplyEnabled,
  quickReplies,
  autoReplies,
  envoi,
  buttonActions,
  tags,
}: {
  numero: { ok: true; numero: WhatsAppNumber } | { ok: false; error: string };
  profil: { ok: true; profil: WhatsAppProfile } | { ok: false; error: string };
  templates: WhatsAppTemplate[];
  aiReplyEnabled: boolean;
  quickReplies: QuickReply[];
  autoReplies: AutoReplies;
  /** Mode d'envoi (variable d'environnement) et numéros de test. */
  envoi: { mode: "dry_run" | "allowlist" | "live"; allowlist: string[] };
  /** Ce que chaque bouton de modèle déclenche. */
  buttonActions: ActionBoutonInput[];
  tags: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-6">
      <SectionNumero numero={numero} envoi={envoi} />
      <SectionProfil profil={profil} nomAffiche={numero.ok ? numero.numero.nom : null} />
      <SectionAuto initial={autoReplies} />
      <SectionIA enabled={aiReplyEnabled} />
      <SectionReponsesRapides items={quickReplies} />
      <SectionModeles templates={templates} buttonActions={buttonActions} tags={tags} />
    </div>
  );
}

export type ActionBoutonInput = {
  template: string;
  buttonText: string;
  tagId: string | null;
  replyText: string | null;
  callSlot: string | null;
  optOut: boolean;
};

// ── Bienvenue et absence ──────────────────────────────

const JOURS = [
  { n: 1, l: "Lun" },
  { n: 2, l: "Mar" },
  { n: 3, l: "Mer" },
  { n: 4, l: "Jeu" },
  { n: 5, l: "Ven" },
  { n: 6, l: "Sam" },
  { n: 7, l: "Dim" },
];

function SectionAuto({ initial }: { initial: AutoReplies }) {
  const router = useRouter();
  const [v, setV] = useState<AutoReplies>(initial);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await saveAutoRepliesAction(v);
      setMessage(r.ok ? { ok: true, texte: "Enregistré." } : { ok: false, texte: r.error });
      if (r.ok) router.refresh();
    });
  }

  const heures = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Section title="Messages automatiques">
      <form onSubmit={enregistrer} className="space-y-4">
        <div className="rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={v.welcomeEnabled}
              onChange={(e) => setV({ ...v, welcomeEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium text-foreground">Message de bienvenue</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Envoyé au <strong className="font-medium text-foreground">premier message</strong> d&apos;un numéro,
            jamais après. <span className="font-mono">{"{{firstName}}"}</span> et{" "}
            <span className="font-mono">{"{{formation}}"}</span> sont remplacés.
          </p>
          {v.welcomeEnabled && (
            <textarea
              value={v.welcomeText}
              onChange={(e) => setV({ ...v, welcomeText: e.target.value })}
              rows={3}
              placeholder={"Bonjour {{firstName}} 👋 Merci pour ton message ! On te répond dans la journée."}
              className={cn(INPUT, "mt-2 resize-y")}
            />
          )}
          {v.welcomeEnabled && <ConseilSortieHumaine texte={v.welcomeText} />}
        </div>

        <div className="rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={v.awayEnabled}
              onChange={(e) => setV({ ...v, awayEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm font-medium text-foreground">Message d&apos;absence</span>
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Envoyé quand un message arrive <strong className="font-medium text-foreground">hors des horaires</strong>{" "}
            ci-dessous (heure de Tunis), au plus une fois par 24 h et par personne.
          </p>
          {v.awayEnabled && (
            <div className="mt-2 space-y-2">
              <textarea
                value={v.awayText}
                onChange={(e) => setV({ ...v, awayText: e.target.value })}
                rows={3}
                placeholder={"Merci pour ton message ! L'équipe est absente pour le moment — on te répond dès l'ouverture."}
                className={cn(INPUT, "resize-y")}
              />
              <ConseilSortieHumaine texte={v.awayText} />
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-muted-foreground">Ouvert de</span>
                <select
                  value={v.awayStart}
                  onChange={(e) => setV({ ...v, awayStart: Number(e.target.value) })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  {heures.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">à</span>
                <select
                  value={v.awayEnd}
                  onChange={(e) => setV({ ...v, awayEnd: Number(e.target.value) })}
                  className="rounded-md border border-border bg-background px-2 py-1"
                >
                  {heures.map((h) => (
                    <option key={h} value={h}>
                      {h}h
                    </option>
                  ))}
                </select>
                <span className="flex flex-wrap gap-1">
                  {JOURS.map((j) => {
                    const on = v.awayDays.includes(j.n);
                    return (
                      <button
                        key={j.n}
                        type="button"
                        onClick={() =>
                          setV({ ...v, awayDays: on ? v.awayDays.filter((d) => d !== j.n) : [...v.awayDays, j.n].sort() })
                        }
                        className={cn(
                          "rounded-md border px-2 py-0.5",
                          on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                        )}
                      >
                        {j.l}
                      </button>
                    );
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          {message && (
            <span className={cn("text-xs", message.ok ? "text-green-700" : "text-red-600")}>{message.texte}</span>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
          >
            {isPending ? "…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Section>
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
                className="shrink-0 text-[12.5px] text-muted-foreground hover:text-red-600"
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
  UNKNOWN: { label: "Pas encore mesurée", cls: "bg-gray-50 text-muted-foreground" },
};

function SectionNumero({
  numero,
  envoi,
}: {
  numero: { ok: true; numero: WhatsAppNumber } | { ok: false; error: string };
  envoi: { mode: "dry_run" | "allowlist" | "live"; allowlist: string[] };
}) {
  // Le mode se règle sur Vercel (WHATSAPP_SEND_MODE), pas ici : on l'affiche
  // pour qu'un « rien ne part » ne soit jamais un mystère.
  const modeLigne =
    envoi.mode === "live" ? (
      <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">Tout part</span>
    ) : envoi.mode === "allowlist" ? (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
        Test — seuls {envoi.allowlist.length} numéro{envoi.allowlist.length > 1 ? "s" : ""} reçoivent
        {envoi.allowlist.length ? ` (+${envoi.allowlist.join(", +")})` : ""}
      </span>
    ) : (
      <span className="rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">
        Rien ne part — tout est journalisé
      </span>
    );
  if (!numero.ok) {
    return (
      <Section title="Le numéro">
        <p className="text-xs text-red-600">{numero.error}</p>
        <p className="mt-2 text-xs">Mode d&apos;envoi : {modeLigne}</p>
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
            "rounded-full px-2 py-0.5 text-[12.5px] font-medium",
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
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-muted-foreground">Mode d&apos;envoi</dt>
          <dd>{modeLigne}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[12.5px] text-muted-foreground/70">
        La qualité, c&apos;est Meta qui la mesure sur les blocages et signalements des destinataires. Elle passe
        au rouge quand trop de gens bloquent le numéro — et Meta réduit alors le nombre d&apos;envois permis.
      </p>
    </Section>
  );
}

// ── Le profil de l'entreprise ─────────────────────────
// Ce que voit un contact qui ouvre la fiche du numéro : photo, description, adresse, sites.
// Chaque enregistrement écrit chez Meta ; l'écran relit ensuite le profil réel.

function SectionProfil({
  profil,
  nomAffiche,
}: {
  profil: { ok: true; profil: WhatsAppProfile } | { ok: false; error: string };
  nomAffiche: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);

  if (!profil.ok) {
    return (
      <Section title="Le profil">
        <p className="text-xs text-red-600">{profil.error}</p>
      </Section>
    );
  }
  const p = profil.profil;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    setOk(false);
    startTransition(async () => {
      const r = await updateProfileAction(fd);
      if (!r.ok) {
        setErreur(r.error);
        return;
      }
      setOk(true);
      setApercu(null);
      router.refresh();
    });
  }

  return (
    <Section title="Le profil">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {(apercu ?? p.profilePictureUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={apercu ?? p.profilePictureUrl ?? ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[12px] text-muted-foreground">
                Pas de photo
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1">
            <label className={LABEL}>Photo de profil</label>
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setApercu(f ? URL.createObjectURL(f) : null);
              }}
              className="block text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
            <p className="text-[12.5px] text-muted-foreground/70">JPG ou PNG, carré de préférence, 5 Mo maximum.</p>
            <p className="pt-1 text-xs text-foreground">
              Nom affiché : <span className="font-medium">{nomAffiche ?? "?"}</span>
              <span className="ml-2 text-[12.5px] text-muted-foreground">
                (le changer passe par WhatsApp Manager et une revue Meta — pas d&apos;ici)
              </span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL}>À propos — la ligne sous le nom (139 car.)</label>
            <input name="about" defaultValue={p.about} maxLength={139} className={INPUT} placeholder="Formations UX/UI Design à Tunis" />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Description (512 car.)</label>
            <textarea name="description" defaultValue={p.description} maxLength={512} rows={3} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Adresse</label>
            <input name="address" defaultValue={p.address} maxLength={256} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input name="email" type="email" defaultValue={p.email} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Site web</label>
            <input name="website1" type="url" defaultValue={p.websites[0] ?? ""} className={INPUT} placeholder="https://thespace.academy" />
          </div>
          <div>
            <label className={LABEL}>Second lien (Instagram…)</label>
            <input name="website2" type="url" defaultValue={p.websites[1] ?? ""} className={INPUT} placeholder="https://instagram.com/…" />
          </div>
          <div>
            <label className={LABEL}>Secteur</label>
            <select name="vertical" defaultValue={p.vertical} className={INPUT}>
              {WHATSAPP_VERTICALS.map((v) => (
                <option key={v.code} value={v.code}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Enregistrement chez Meta…" : "Enregistrer le profil"}
          </button>
          {ok && <span className="text-xs text-green-700">Profil mis à jour — c&apos;est ce que WhatsApp affiche maintenant.</span>}
          {erreur && <span className="text-xs text-red-600">{erreur}</span>}
        </div>
      </form>
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
  DISABLED: { label: "Désactivé", cls: "bg-gray-50 text-muted-foreground" },
};

function SectionModeles({
  templates,
  buttonActions,
  tags,
}: {
  templates: WhatsAppTemplate[];
  buttonActions: ActionBoutonInput[];
  tags: { id: string; name: string }[];
}) {
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
            <LigneModele
              key={t.id}
              t={t}
              actions={buttonActions.filter((a) => a.template === t.name)}
              tags={tags}
            />
          ))}
        </ul>
      )}

      <NouveauModele existants={templates.map((t) => t.name)} />
    </Section>
  );
}

function LigneModele({
  t,
  actions,
  tags,
}: {
  t: WhatsAppTemplate;
  actions: ActionBoutonInput[];
  tags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [edition, setEdition] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const s = STATUT[t.status] ?? { label: t.status, cls: "bg-gray-50 text-muted-foreground" };

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
        <span className="text-[12.5px] text-muted-foreground">
          {LANGUES.find((l) => l.code === t.language)?.label ?? t.language} · {t.category.toLowerCase()}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[12.5px] font-medium", s.cls)}>{s.label}</span>
        <span className="flex-1" />
        {!edition && !confirme && (
          <button type="button" onClick={() => setEdition(true)} className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline">
            Modifier
          </button>
        )}
        {confirme ? (
          <>
            <button
              type="button"
              onClick={supprimer}
              disabled={isPending}
              className="text-[12.5px] font-medium text-red-600 hover:underline disabled:opacity-40"
            >
              {isPending ? "…" : "Confirmer la suppression"}
            </button>
            <button type="button" onClick={() => setConfirme(false)} className="text-[12.5px] text-muted-foreground hover:underline">
              Annuler
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirme(true)} className="text-[12.5px] text-muted-foreground hover:text-red-600 hover:underline">
            Supprimer
          </button>
        )}
      </div>
      {edition ? (
        <EditeurModele t={t} onFermer={() => setEdition(false)} />
      ) : (
        t.body && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>
      )}
      {t.autresBoutons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {t.autresBoutons.map((b) => (
            <span key={b} className="rounded-md border border-border px-2 py-0.5 text-[12.5px] text-muted-foreground">
              {b}
            </span>
          ))}
        </div>
      )}
      {t.buttons.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {t.buttons.map((b) => (
            <ActionBouton
              key={b}
              template={t.name}
              button={b}
              initial={actions.find((a) => a.buttonText === b) ?? null}
              tags={tags}
            />
          ))}
        </div>
      )}
      {t.rejectedReason && <p className="mt-1 text-[12.5px] text-red-600">Motif de Meta : {t.rejectedReason}</p>}
      {erreur && <p className="mt-1 text-[12.5px] text-red-600">{erreur}</p>}
    </li>
  );
}

// Règle Meta : toute réponse automatique doit offrir une sortie vers un
// humain (téléphone, email, ou « écrivez humain »). Un conseil, pas un
// blocage : le texte reste à Marwen.
function ConseilSortieHumaine({ texte }: { texte: string }) {
  const ok = /humain|appel|t[ée]l[ée]phone|\+216|@|email|e-mail|mail/i.test(texte);
  if (ok) return null;
  return (
    <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-[13px] text-amber-700">
      Meta exige qu&apos;un message automatique dise comment joindre un humain : ajoute un numéro,
      un email, ou « répondez <strong className="font-medium">humain</strong> pour parler à l&apos;équipe ».
    </p>
  );
}

// Un bouton = une intention. Ici on dit ce que le CRM en fait : tag,
// réponse dans la fenêtre que le tap vient d'ouvrir, tâche d'appel au créneau
// choisi, ou désabonnement. Tout vide = rien de spécial, le tap reste une
// réponse comme une autre.
const CRENEAUX = [
  { value: "", label: "— pas de rappel —" },
  { value: "now", label: "Rappel : maintenant" },
  { value: "evening", label: "Rappel : ce soir après 18 h" },
  { value: "tomorrow", label: "Rappel : demain matin" },
];

function ActionBouton({
  template,
  button,
  initial,
  tags,
}: {
  template: string;
  button: string;
  initial: ActionBoutonInput | null;
  tags: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tagId, setTagId] = useState(initial?.tagId ?? "");
  const [reply, setReply] = useState(initial?.replyText ?? "");
  const [slot, setSlot] = useState(initial?.callSlot ?? "");
  const [optOut, setOptOut] = useState(initial?.optOut ?? false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const configure = !!(initial?.tagId || initial?.replyText || initial?.callSlot || initial?.optOut);

  function enregistrer() {
    setErreur(null);
    startTransition(async () => {
      const r = await saveButtonActionAction({
        template,
        buttonText: button,
        tagId: tagId || null,
        replyText: reply.trim() || null,
        callSlot: slot || null,
        optOut,
      });
      if (r.ok) {
        setOpen(false);
        router.refresh();
      } else setErreur(r.error);
    });
  }

  const resume = [
    initial?.tagId ? `tag ${tags.find((x) => x.id === initial.tagId)?.name ?? "?"}` : null,
    initial?.replyText ? "réponse" : null,
    initial?.callSlot ? CRENEAUX.find((c) => c.value === initial.callSlot)?.label.toLowerCase() : null,
    initial?.optOut ? "désabonne" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-md border border-border px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border px-2 py-0.5 text-[12.5px] text-foreground">{button}</span>
        <span className="text-[12.5px] text-muted-foreground">{configure ? `→ ${resume}` : "→ rien de spécial"}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-[12.5px] text-primary hover:underline">
          {open ? "Fermer" : "Régler"}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={INPUT}>
              <option value="">— pas de tag —</option>
              {tags.map((x) => (
                <option key={x.id} value={x.id}>
                  Tag : {x.name}
                </option>
              ))}
            </select>
            <select value={slot} onChange={(e) => setSlot(e.target.value)} className={INPUT}>
              {CRENEAUX.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="Réponse envoyée tout de suite (texte libre : le tap a ouvert la fenêtre de 24 h)"
            className={cn(INPUT, "resize-y")}
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={optOut} onChange={(e) => setOptOut(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Ce bouton = « ne plus m&apos;écrire » (désabonnement WhatsApp, confirmation envoyée)
          </label>
          {erreur && <p className="text-[13px] text-red-600">{erreur}</p>}
          <button
            type="button"
            onClick={enregistrer}
            disabled={isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "…" : "Enregistrer"}
          </button>
        </div>
      )}
    </div>
  );
}

function compterVariables(body: string): number {
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
}

/**
 * Modifier le texte d'un modèle déjà chez Meta. Les boutons ne bougent pas ;
 * si le nombre de variables change, les règles qui l'envoient sont listées
 * avant l'envoi (elles partiraient avec le mauvais nombre).
 */
function EditeurModele({ t, onFermer }: { t: WhatsAppTemplate; onFermer: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState(t.body ?? "");
  const [examples, setExamples] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [aConfirmer, setAConfirmer] = useState<{ formation: string; colonne: string; variables: number }[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const n = compterVariables(body);
  const inchange = body.trim() === (t.body ?? "").trim();

  function envoyer(confirme = false) {
    setMessage(null);
    startTransition(async () => {
      const r = await editTemplateAction({ name: t.name, body, examples, confirme });
      if (r.ok) {
        setAConfirmer(null);
        setMessage({ ok: true, texte: "Envoyé à Meta : le modèle repasse « en attente » le temps de la relecture." });
        router.refresh();
      } else if ("aConfirmer" in r) {
        setAConfirmer(r.aConfirmer);
      } else {
        setMessage({ ok: false, texte: r.error });
      }
    });
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
      <label>
        <span className={LABEL}>Message</span>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setAConfirmer(null);
          }}
          rows={6}
          maxLength={1024}
          dir="auto"
          className={cn(INPUT, "resize-y")}
        />
        <span className="text-[12.5px] text-muted-foreground">
          {n} variable{n > 1 ? "s" : ""} · {body.length}/1024
        </span>
      </label>

      <RelectureIA
        name={t.name}
        category={t.category}
        language={t.language}
        body={body}
        buttons={[...t.buttons, ...t.autresBoutons]}
        onUtiliser={setBody}
      />

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
                placeholder={i === 0 ? "سنا" : "UX/UI Bootcamp"}
                className={INPUT}
              />
            </label>
          ))}
          <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
            Meta relit le message avec ces exemples à la place des variables.
          </p>
        </div>
      )}

      <p className="text-[12.5px] text-muted-foreground">
        Les boutons restent tels quels. Meta relit le modèle à nouveau (quelques minutes en général), garde sa
        catégorie ({t.category.toLowerCase()}) et limite les modifications d&apos;un modèle approuvé à une par jour.
      </p>

      {aConfirmer && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12.5px] text-amber-900">
          <p className="font-medium">
            Le modèle passe à {n} variable{n > 1 ? "s" : ""}, mais ces règles en envoient un autre nombre : elles
            échoueront tant que vous ne les aurez pas corrigées (Automatisation de la colonne).
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {aConfirmer.map((r) => (
              <li key={`${r.formation}-${r.colonne}`}>
                {r.formation} → colonne « {r.colonne} » ({r.variables} variable{r.variables > 1 ? "s" : ""})
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => envoyer(true)}
            disabled={isPending}
            className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Envoyer quand même
          </button>
        </div>
      )}

      {message && <p className={cn("text-xs", message.ok ? "text-green-700" : "text-red-600")}>{message.texte}</p>}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onFermer} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
          Fermer
        </button>
        <button
          type="button"
          onClick={() => envoyer()}
          disabled={isPending || inchange || !body.trim()}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {isPending ? "Envoi à Meta…" : "Envoyer à Meta"}
        </button>
      </div>
    </div>
  );
}

type Relecture = {
  verdict: "passe" | "risque" | "refus";
  categorieProbable: "MARKETING" | "UTILITY";
  problemes: string[];
  conseils: string[];
  versionProposee: string;
};

const VERDICT: Record<Relecture["verdict"], { label: string; cls: string }> = {
  passe: { label: "✓ Devrait passer chez Meta", cls: "border-green-200 bg-green-50 text-green-900" },
  risque: { label: "⚠ Risque de refus ou de reclassement", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  refus: { label: "✗ Meta le refusera tel quel", cls: "border-red-200 bg-red-50 text-red-900" },
};

/** « Améliorer avec l'IA » : relit le texte courant et propose une version à reprendre d'un clic. */
function RelectureIA({
  name,
  category,
  language,
  body,
  buttons,
  onUtiliser,
}: {
  name: string;
  category: string;
  language: string;
  body: string;
  buttons: string[];
  onUtiliser: (texte: string) => void;
}) {
  const [relecture, setRelecture] = useState<Relecture | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function relire() {
    setErreur(null);
    startTransition(async () => {
      const r = await reviewTemplateAction({ name, category, language, body, buttons });
      if (r.ok) setRelecture(r.review);
      else setErreur(r.error);
    });
  }

  const v = relecture ? VERDICT[relecture.verdict] : null;
  return (
    <div>
      <button
        type="button"
        onClick={relire}
        disabled={isPending || !body.trim()}
        className="rounded-lg border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-40"
      >
        {isPending ? "L'IA relit…" : "✨ Améliorer avec l'IA"}
      </button>
      {erreur && <p className="mt-1 text-[12.5px] text-red-600">{erreur}</p>}
      {relecture && v && (
        <div className={cn("mt-2 space-y-2 rounded-lg border p-3 text-[12.5px]", v.cls)}>
          <p className="font-medium">
            {v.label} · catégorie probable : {relecture.categorieProbable.toLowerCase()}
            {relecture.categorieProbable !== category.toUpperCase() && ` (demandée : ${category.toLowerCase()})`}
          </p>
          {relecture.problemes.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4">
              {relecture.problemes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          {relecture.conseils.length > 0 && (
            <div>
              <p className="font-medium">Conseils</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {relecture.conseils.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {relecture.versionProposee.trim() && relecture.versionProposee.trim() !== body.trim() && (
            <div>
              <p className="font-medium">Version proposée</p>
              <p dir="auto" className="mt-1 whitespace-pre-wrap rounded-md bg-background/70 p-2 text-foreground">
                {relecture.versionProposee}
              </p>
              <button
                type="button"
                onClick={() => {
                  onUtiliser(relecture.versionProposee);
                  setRelecture(null);
                }}
                className="mt-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
              >
                Utiliser cette version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NouveauModele({ existants }: { existants: string[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("fr");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [buttons, setButtons] = useState<string[]>(["", "", ""]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const n = compterVariables(body);
  const nomPris = existants.includes(name.trim().toLowerCase());

  function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const r = await createTemplateAction({ name, language, category, body, examples, buttons });
      if (r.ok) {
        setMessage({ ok: true, texte: "Soumis à Meta. Il apparaît « en attente » jusqu'à sa relecture." });
        setName("");
        setBody("");
        setExamples([]);
        setButtons(["", "", ""]);
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
          {nomPris && <span className="text-[12.5px] text-red-600">Ce nom existe déjà.</span>}
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
        <span className="text-[12.5px] text-muted-foreground">
          {"{{1}}"}, {"{{2}}"}… sont les variables, remplies à l&apos;envoi. {body.length}/1024
        </span>
      </label>

      <RelectureIA
        name={name || "nouveau_modele"}
        category={category}
        language={language}
        body={body}
        buttons={buttons.filter((b) => b.trim())}
        onUtiliser={setBody}
      />

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
          <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
            Meta relit le message avec ces exemples à la place des variables.
          </p>
        </div>
      )}
      <div>
        <span className={LABEL}>Boutons de réponse rapide (3 max, 25 car.)</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {buttons.map((b, i) => (
            <input
              key={i}
              value={b}
              maxLength={25}
              onChange={(e) => {
                const v = [...buttons];
                v[i] = e.target.value;
                setButtons(v);
              }}
              placeholder={["Oui, appelez-moi", "Plus tard", "Une question"][i]}
              className={INPUT}
            />
          ))}
        </div>
        <span className="text-[12.5px] text-muted-foreground">
          Un tap sur un bouton compte comme une réponse du lead : la fenêtre de 24 h s&apos;ouvre et on peut lui écrire librement.
        </span>
      </div>

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
