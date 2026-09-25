"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ajouterSavoirFichierAction,
  ajouterSavoirLienAction,
  ajouterSavoirTexteAction,
  saveAssistantAction,
  statutSavoirAction,
  supprimerSavoirAction,
} from "@/app/whatsapp-actions";

export type SavoirItem = {
  id: string;
  kind: string;
  title: string;
  content: string;
  source: string | null;
  status: string;
  createdAt: string;
};

const MODES = [
  { v: "off", l: "Éteint", d: "L'assistant ne fait rien." },
  { v: "repetition", l: "Répétition", d: "Il rédige et note ses réponses dans la page Messages, sans rien envoyer." },
  { v: "auto", l: "Automatique", d: "Il envoie ses réponses sûres, et passe la main pour les autres. Bientôt." },
] as const;

const TYPE: Record<string, string> = { texte: "Texte", fichier: "Fichier", lien: "Lien", souvenir: "Souvenir" };

/**
 * L'assistant WhatsApp : son mode, son seuil de confiance, ses consignes, et
 * tout le savoir qu'on lui donne (textes, fichiers, liens) — plus, à terme,
 * les souvenirs qu'il apprend des réponses de l'équipe.
 */
export function AssistantWhatsApp({
  mode,
  threshold,
  instructions,
  savoir,
}: {
  mode: string;
  threshold: number;
  instructions: string;
  savoir: SavoirItem[];
}) {
  const router = useRouter();
  const [m, setM] = useState(mode);
  const [seuil, setSeuil] = useState(threshold);
  const [consignes, setConsignes] = useState(instructions);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function enregistrer() {
    setMessage(null);
    startTransition(async () => {
      const r = await saveAssistantAction({ mode: m as "off" | "repetition" | "auto", threshold: seuil, instructions: consignes });
      setMessage(r.ok ? { ok: true, texte: "Enregistré." } : { ok: false, texte: r.error });
      if (r.ok) router.refresh();
    });
  }

  const actifs = savoir.filter((s) => s.status === "actif");
  const volume = actifs.reduce((n, s) => n + s.content.length, 0);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 font-heading text-sm font-semibold text-foreground">Assistant WhatsApp</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Il répond aux messages avec ce que le CRM sait de la personne et le savoir ci-dessous. Il note chaque
        réponse : sous le seuil, il ne répond pas lui-même et passe la main à l&apos;équipe. Ce qui touche à
        l&apos;argent (RIB, paiement, remboursement) passe toujours par un humain.
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((x) => (
          <button
            key={x.v}
            type="button"
            disabled={x.v === "auto"}
            onClick={() => setM(x.v)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              m === x.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            )}
          >
            <p className="text-sm font-medium text-foreground">{x.l}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{x.d}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
        <label>
          <span className="mb-1 block text-[12.5px] font-medium text-foreground">Seuil de confiance</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={seuil}
              onChange={(e) => setSeuil(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right text-sm tabular-nums text-foreground">{seuil} %</span>
          </div>
          <span className="text-[12px] text-muted-foreground">Sous ce score, il passe la main.</span>
        </label>
        <label>
          <span className="mb-1 block text-[12.5px] font-medium text-foreground">Consignes et ton</span>
          <textarea
            value={consignes}
            onChange={(e) => setConsignes(e.target.value)}
            rows={4}
            placeholder={"Ex. : Réponds en derja, tutoie, reste court. Ne promets jamais de réduction sans code. Pour une question de paiement, dis qu'un conseiller rappelle."}
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {message && <span className={cn("text-xs", message.ok ? "text-green-700" : "text-red-600")}>{message.texte}</span>}
        <button
          type="button"
          onClick={enregistrer}
          disabled={isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">Son savoir</h4>
          <span className="text-[12.5px] text-muted-foreground">
            {actifs.length} source{actifs.length > 1 ? "s" : ""} active{actifs.length > 1 ? "s" : ""} · {Math.round(volume / 1000)} k caractères
          </span>
        </div>
        <AjoutSavoir />
        {savoir.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Rien pour l&apos;instant. Ajoutez la brochure, la page du programme, vos réponses habituelles…
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {savoir.map((s) => (
              <LigneSavoir key={s.id} s={s} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AjoutSavoir() {
  const router = useRouter();
  const [onglet, setOnglet] = useState<"texte" | "fichier" | "lien" | null>(null);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [lien, setLien] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function fini(r: { ok: boolean; error?: string; coupe?: boolean }) {
    if (r.ok) {
      setMessage({ ok: true, texte: r.coupe ? "Ajouté (texte très long : seul le début est gardé)." : "Ajouté." });
      setTitre("");
      setTexte("");
      setLien("");
      router.refresh();
    } else {
      setMessage({ ok: false, texte: r.error ?? "Échec." });
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["texte", "+ Texte"],
            ["fichier", "+ Fichier (PDF, TXT)"],
            ["lien", "+ Lien (page web)"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setOnglet(onglet === v ? null : v);
              setMessage(null);
            }}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs",
              onglet === v ? "border-primary text-primary" : "border-border text-foreground hover:bg-muted"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {onglet === "texte" && (
        <div className="mt-3 space-y-2">
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre (ex. Modalités de paiement)"
            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
          />
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={6}
            placeholder="Le texte que l'assistant doit connaître…"
            className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button
            type="button"
            disabled={isPending || !titre.trim() || !texte.trim()}
            onClick={() => startTransition(async () => fini(await ajouterSavoirTexteAction(titre, texte)))}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Ajout…" : "Ajouter"}
          </button>
        </div>
      )}

      {onglet === "fichier" && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          action={(fd) => startTransition(async () => fini(await ajouterSavoirFichierAction(fd)))}
        >
          <input type="file" name="fichier" accept=".pdf,.txt,.md,.csv,application/pdf,text/plain" className="text-xs" />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Lecture du fichier…" : "Ajouter"}
          </button>
          <span className="w-full text-[12px] text-muted-foreground">
            Un PDF est lu par l&apos;IA à l&apos;ajout (quelques secondes à une minute) ; seul son texte est gardé.
          </span>
        </form>
      )}

      {onglet === "lien" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="https://thespace.academy/…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
          />
          <button
            type="button"
            disabled={isPending || !lien.trim()}
            onClick={() => startTransition(async () => fini(await ajouterSavoirLienAction(lien)))}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {isPending ? "Lecture de la page…" : "Ajouter"}
          </button>
          <span className="w-full text-[12px] text-muted-foreground">
            La page est lue une fois : si elle change, supprimez-la et ajoutez-la de nouveau.
          </span>
        </div>
      )}

      {message && <p className={cn("mt-2 text-xs", message.ok ? "text-green-700" : "text-red-600")}>{message.texte}</p>}
    </div>
  );
}

function LigneSavoir({ s }: { s: SavoirItem }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const [isPending, startTransition] = useTransition();
  const actif = s.status === "actif";

  return (
    <li className="px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] text-muted-foreground">{TYPE[s.kind] ?? s.kind}</span>
        <button type="button" onClick={() => setOuvert(!ouvert)} className="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:underline">
          {s.title}
        </button>
        <span className="text-[12px] tabular-nums text-muted-foreground">{Math.round(s.content.length / 100) / 10} k</span>
        {s.status === "a_valider" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] text-amber-800">à valider</span>}
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(async () => { await statutSavoirAction(s.id, actif ? "archive" : "actif"); router.refresh(); })}
          className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline"
        >
          {actif ? "Mettre de côté" : "Activer"}
        </button>
        {confirme ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(async () => { await supprimerSavoirAction(s.id); router.refresh(); })}
            className="text-[12.5px] font-medium text-red-600 hover:underline"
          >
            Confirmer
          </button>
        ) : (
          <button type="button" onClick={() => setConfirme(true)} className="text-[12.5px] text-muted-foreground hover:text-red-600 hover:underline">
            Supprimer
          </button>
        )}
      </div>
      {s.source && s.kind === "lien" && (
        <a href={s.source} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[12px] text-muted-foreground underline">
          {s.source}
        </a>
      )}
      {ouvert && (
        <p dir="auto" className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[12.5px] text-muted-foreground">
          {s.content}
        </p>
      )}
    </li>
  );
}
