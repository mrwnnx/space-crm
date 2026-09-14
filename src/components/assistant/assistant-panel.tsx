"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  askAssistantAction,
  getAssistantHistoryAction,
  clearAssistantAction,
} from "@/app/actions";

type Msg = { role: string; content: string };

/**
 * L'assistant du CRM — panneau latéral droit.
 *
 * Il se glisse PAR-DESSUS l'écran courant sans le décaler : c'est le seul
 * placement où la fiche d'un lead et ce que l'assistant en dit tiennent dans le
 * même regard. Choisi sur maquettes contre la barre ⌘K, qui couvrait
 * précisément ce qu'on voulait vérifier.
 *
 * ⚠️ Lot 1 : LECTURE SEULE. Les outils qui écrivent viendront avec leur aperçu.
 */
export function AssistantPanel() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [charge, setCharge] = useState(false);
  const [texte, setTexte] = useState("");
  const [isPending, startTransition] = useTransition();
  const filRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  // ⌘J / Ctrl+J ouvre et ferme, Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || charge) return;
    setCharge(true);
    getAssistantHistoryAction()
      .then(setMsgs)
      .catch(() => setMsgs([]));
  }, [open, charge]);

  useEffect(() => {
    if (open) champRef.current?.focus();
  }, [open]);

  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, isPending]);

  function envoyer() {
    const q = texte.trim();
    if (!q || isPending) return;
    setTexte("");
    setMsgs((m) => [...m, { role: "user", content: q }]);
    // Le chemin courant part avec la question : sur une fiche, « lui » désigne
    // ce lead sans qu'on ait à le nommer.
    const contexte = `Contexte : l'utilisateur regarde la page ${pathname}. Si cette adresse contient l'identifiant d'un lead ou d'une formation, c'est de celui-là qu'il parle quand il dit « lui », « ce lead » ou « cette formation ».`;
    startTransition(async () => {
      const res = await askAssistantAction(q, contexte);
      const erreur = "error" in res ? res.error : undefined;
      if (erreur) {
        setMsgs((m) => [...m, { role: "assistant", content: erreur }]);
        return;
      }
      if ("reponse" in res && res.reponse) {
        const r = res.reponse;
        setMsgs((m) => [...m, { role: "assistant", content: r }]);
      }
    });
  }

  function vider() {
    startTransition(async () => {
      await clearAssistantAction();
      setMsgs([]);
    });
  }

  return (
    <>
      {/* Toujours accessible, jamais dans le chemin : en bas à droite. */}
      <button
        onClick={() => setOpen(true)}
        title="Assistant (⌘J)"
        aria-label="Ouvrir l'assistant"
        className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-primary text-base text-primary-foreground shadow-lg transition-transform hover:scale-105 ${
          open ? "hidden" : ""
        }`}
      >
        ✦
      </button>

      {open && (
        <>
          {/* Voile léger : on doit continuer à LIRE l'écran derrière. */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[380px]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-foreground">Assistant</p>
                <p className="text-[10.5px] text-muted-foreground">
                  Il lit le CRM. Il ne modifie encore rien.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {msgs.length > 0 && (
                  <button
                    onClick={vider}
                    title="Effacer la conversation"
                    className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    Effacer
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="rounded-lg px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  ×
                </button>
              </div>
            </div>

            <div ref={filRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.length === 0 && !isPending && (
                <div className="space-y-2.5">
                  <p className="text-xs text-muted-foreground">Par exemple :</p>
                  {[
                    "qui je dois rappeler aujourd'hui ?",
                    "les leads qui ont demandé un rappel et qu'on n'a jamais appelés",
                    "où en est cette formation ?",
                    "résume-moi ce lead",
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setTexte(ex)}
                      className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}

              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[90%] rounded-xl rounded-br-sm bg-primary px-3 py-2 text-xs leading-relaxed text-primary-foreground"
                      : "max-w-[95%] whitespace-pre-wrap text-xs leading-relaxed text-foreground"
                  }
                >
                  {m.content}
                </div>
              ))}

              {isPending && (
                <p className="animate-pulse font-mono text-[10.5px] uppercase tracking-wider text-primary">
                  Hani nkhamem…
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-border p-3">
              <textarea
                ref={champRef}
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                onKeyDown={(e) => {
                  // Entrée envoie, Maj+Entrée va à la ligne : on écrit une
                  // question, pas un paragraphe.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    envoyer();
                  }
                }}
                rows={2}
                placeholder="Écris ou dicte ta question…"
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span className="font-mono text-[9.5px] text-muted-foreground">⌘J</span>
                <button
                  onClick={envoyer}
                  disabled={isPending || !texte.trim()}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                >
                  {isPending ? "…" : "Envoyer"}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
