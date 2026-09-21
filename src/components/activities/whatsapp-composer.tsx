"use client";

import { useEffect, useState, useTransition } from "react";
import { sendWhatsAppAction } from "@/app/actions";
import {
  replyWhatsAppAction,
  replyWhatsAppTemplateAction,
  whatsAppComposerDataAction,
} from "@/app/whatsapp-actions";
import { ApercuModele } from "@/components/whatsapp/template-preview";

type Donnees = Extract<Awaited<ReturnType<typeof whatsAppComposerDataAction>>, { ok: true }>;

/** Les valeurs du lead qu'on peut insérer dans une variable, avec leur libellé. */
const LIBELLES: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  fullName: "Nom complet",
  formation: "Formation",
  dateDebut: "Date de début",
  offre: "Offre",
  email: "Email",
};

export function WhatsAppComposer({
  referenceType,
  referenceId,
  to,
  onClose,
}: {
  referenceType: "lead" | "deal";
  referenceId: string;
  to: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"libre" | "modele">("libre");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  // Fenêtre, modèles, valeurs du lead : chargés une fois par fiche (appel Meta ≈ 0,5 s).
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  useEffect(() => {
    if (referenceType !== "lead" || !to) return;
    whatsAppComposerDataAction(referenceId).then((d) => {
      if (!d.ok) return;
      setDonnees(d);
      // Fenêtre fermée : seul un modèle peut partir, autant l'ouvrir directement.
      if (!d.ouverte) setMode("modele");
    });
  }, [referenceType, referenceId, to]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!to || !content.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      // Un lead passe par l'action de la page Messages : c'est elle qui garde
      // le wamid, donc les accusés (livré, lu, échec) sous la bulle.
      const result =
        referenceType === "lead"
          ? await replyWhatsAppAction(referenceId, to, content)
          : await sendWhatsAppAction(referenceType, referenceId, to, content);
      setFeedback(
        result.ok
          ? { ok: true, msg: "WhatsApp envoyé" }
          : { ok: false, msg: result.error || "Échec" }
      );
      if (result.ok) {
        setContent("");
        setTimeout(onClose, 1500);
      }
    });
  }

  if (!to) {
    return (
      <p className="py-2 text-center text-xs text-muted-foreground">
        Aucun numéro WhatsApp sur ce contact
      </p>
    );
  }

  const ouverte = donnees?.ouverte ?? true;
  const finFenetre =
    donnees?.dernierEntrant &&
    new Date(new Date(donnees.dernierEntrant).getTime() + 24 * 3600e3).toLocaleString("fr-FR", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">To:</span>
        <span className="text-xs font-medium text-foreground">{to}</span>
        {donnees && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] ${
              ouverte ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-500"
            }`}
          >
            {ouverte ? `Fenêtre ouverte jusqu'à ${finFenetre}` : "Fenêtre de 24 h fermée : modèle seulement"}
          </span>
        )}
      </div>

      {referenceType === "lead" && (
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
          {(
            [
              ["libre", "Message libre"],
              ["modele", "Modèle"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              disabled={v === "libre" && !ouverte}
              onClick={() => setMode(v)}
              title={v === "libre" && !ouverte ? "Cette personne n'a pas écrit depuis plus de 24 h" : undefined}
              className={`flex-1 rounded-md px-2 py-1 font-medium transition-colors disabled:opacity-40 ${
                mode === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === "libre" ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Votre message WhatsApp..."
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {feedback && (
            <p className={feedback.ok ? "text-xs text-green-600" : "text-xs text-red-600"}>
              {feedback.msg}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
              Annuler
            </button>
            <button type="submit" disabled={isPending || !content.trim()} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">
              {isPending ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      ) : donnees ? (
        <EnvoiModele leadId={referenceId} to={to} donnees={donnees} onClose={onClose} />
      ) : (
        <p className="text-xs text-muted-foreground">Chargement des modèles…</p>
      )}
    </div>
  );
}

/**
 * Un modèle approuvé, ses variables préremplies avec ce que le CRM sait du
 * lead (le mapping d'une règle existante, sinon le prénom en {{1}}), chaque
 * valeur modifiable, l'aperçu qui suit.
 */
function EnvoiModele({
  leadId,
  to,
  donnees,
  onClose,
}: {
  leadId: string;
  to: string;
  donnees: Donnees;
  onClose: () => void;
}) {
  const [nom, setNom] = useState("");
  const [valeurs, setValeurs] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const modele = donnees.modeles.find((m) => m.name === nom) ?? null;
  const dico = donnees.valeurs[modele?.language.startsWith("ar") ? "ar" : "fr"];

  function choisir(name: string) {
    setNom(name);
    setFeedback(null);
    const m = donnees.modeles.find((x) => x.name === name);
    if (!m) return setValeurs([]);
    const mapping = donnees.mappings[name] ?? [];
    const d = donnees.valeurs[m.language.startsWith("ar") ? "ar" : "fr"];
    setValeurs(
      Array.from({ length: m.variables }, (_, i) => {
        const cle = mapping[i] ?? (i === 0 ? "firstName" : "");
        // Un nom du CRM → la valeur du lead ; autre chose → une valeur fixe, telle quelle.
        return cle ? (d[cle] ?? cle) : "";
      })
    );
  }

  function envoyer() {
    if (!modele || isPending) return;
    setFeedback(null);
    startTransition(async () => {
      const r = await replyWhatsAppTemplateAction(
        leadId,
        to,
        { name: modele.name, language: modele.language, body: modele.body },
        valeurs.map((v) => v.trim())
      );
      setFeedback(r.ok ? { ok: true, msg: "Modèle envoyé" } : { ok: false, msg: r.error });
      if (r.ok) setTimeout(onClose, 1500);
    });
  }

  const manque = modele ? valeurs.slice(0, modele.variables).some((v) => !v?.trim()) : true;

  return (
    <div className="space-y-2">
      <select
        value={nom}
        onChange={(e) => choisir(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      >
        <option value="">Choisir un modèle…</option>
        {donnees.modeles.map((m) => (
          <option key={`${m.name}|${m.language}`} value={m.name}>
            {m.name} — {m.language} · {m.category === "MARKETING" ? "marketing" : "utilitaire"}
            {m.variables ? ` · ${m.variables} variable${m.variables > 1 ? "s" : ""}` : ""}
          </option>
        ))}
      </select>

      {modele?.body && <ApercuModele body={modele.body} buttons={modele.buttons} valeurs={valeurs} />}

      {modele &&
        Array.from({ length: modele.variables }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-12 shrink-0 font-mono text-[12px] text-muted-foreground">{`{{${i + 1}}}`}</span>
            <input
              value={valeurs[i] ?? ""}
              onChange={(e) => {
                const v = [...valeurs];
                v[i] = e.target.value;
                setValeurs(v);
              }}
              placeholder={`Valeur de {{${i + 1}}}`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
            />
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                const v = [...valeurs];
                v[i] = dico[e.target.value] ?? "";
                setValeurs(v);
              }}
              title="Insérer une valeur du lead"
              className="w-28 shrink-0 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground outline-none focus:border-ring"
            >
              <option value="">Insérer…</option>
              {Object.entries(LIBELLES)
                .filter(([k]) => dico[k])
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label} : {dico[k]}
                  </option>
                ))}
            </select>
          </div>
        ))}

      {modele && modele.category === "MARKETING" && (
        <p className="text-[12px] text-muted-foreground">
          Marketing : part seulement avec un consentement tracé, et pas deux fois en 24 h vers la même personne.
        </p>
      )}
      {feedback && (
        <p className={feedback.ok ? "text-xs text-green-600" : "text-xs text-red-600"}>{feedback.msg}</p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted">
          Annuler
        </button>
        <button
          type="button"
          onClick={envoyer}
          disabled={isPending || !modele || manque}
          title={manque && modele ? "Toutes les variables doivent avoir une valeur" : undefined}
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Envoi..." : "Envoyer le modèle"}
        </button>
      </div>
    </div>
  );
}
