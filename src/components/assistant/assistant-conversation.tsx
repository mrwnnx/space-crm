"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import {
  askAssistantAction,
  getAssistantHistoryAction,
  clearAssistantAction,
} from "@/app/actions";

type Msg = { role: string; content: string };

const EXEMPLES = [
  "qui je dois rappeler aujourd'hui ?",
  "les leads qui ont demandé un rappel et qu'on n'a jamais appelés",
  "où en est la formation september 2026 ?",
  "résume-moi ce lead",
];

/**
 * Le fil de conversation, partagé par le panneau latéral et la page dédiée.
 *
 * Un seul composant pour les deux : la conversation est la MÊME des deux côtés
 * — elle vit en base, par utilisateur. Deux implémentations auraient fini par
 * diverger sur un détail, et c'est toujours celui qui compte.
 */
export function AssistantConversation({ large = false }: { large?: boolean }) {
  const pathname = usePathname();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texte, setTexte] = useState("");
  const [isPending, startTransition] = useTransition();
  const filRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getAssistantHistoryAction()
      .then(setMsgs)
      .catch(() => setMsgs([]));
    champRef.current?.focus();
  }, []);

  useEffect(() => {
    filRef.current?.scrollTo({ top: filRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, isPending]);

  // Une autre partie du CRM peut lancer une question — le bouton « Demander à
  // l'assistant » d'une fiche lead, par exemple.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      if (typeof q === "string" && q.trim()) envoyer(q);
    };
    window.addEventListener("assistant:ask", onAsk);
    return () => window.removeEventListener("assistant:ask", onAsk);
  });

  function envoyer(force?: string) {
    const q = (force ?? texte).trim();
    if (!q || isPending) return;
    if (!force) setTexte("");
    setMsgs((m) => [...m, { role: "user", content: q }]);
    const contexte = `Contexte : l'utilisateur regarde la page ${pathname}. Si cette adresse contient l'identifiant d'un lead ou d'une formation, c'est de celui-là qu'il parle quand il dit « lui », « ce lead » ou « cette formation ».`;
    startTransition(async () => {
      const res = await askAssistantAction(q, contexte);
      const erreur = "error" in res ? res.error : undefined;
      if (erreur) return setMsgs((m) => [...m, { role: "assistant", content: erreur }]);
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
      <div
        ref={filRef}
        className={`flex-1 overflow-y-auto px-4 py-4 ${large ? "sm:px-6" : ""}`}
      >
        <div className={large ? "mx-auto max-w-2xl space-y-3" : "space-y-3"}>
          {msgs.length === 0 && !isPending && (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">Par exemple :</p>
              {EXEMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => envoyer(ex)}
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
      </div>

      <div className={`shrink-0 border-t border-border p-3 ${large ? "sm:px-6 sm:py-4" : ""}`}>
        <div className={large ? "mx-auto max-w-2xl" : ""}>
          <textarea
            ref={champRef}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              // Entrée envoie, Maj+Entrée va à la ligne : on écrit une question,
              // pas un paragraphe.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                envoyer();
              }
            }}
            rows={large ? 3 : 2}
            placeholder="Écris ou dicte ta question…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <div className="mt-1.5 flex items-center justify-between">
            {msgs.length > 0 ? (
              <button
                onClick={vider}
                className="text-[10.5px] text-muted-foreground underline hover:text-foreground"
              >
                Effacer la conversation
              </button>
            ) : (
              <span className="font-mono text-[9.5px] text-muted-foreground">⌘J</span>
            )}
            <button
              onClick={() => envoyer()}
              disabled={isPending || !texte.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {isPending ? "…" : "Envoyer"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
