"use client";

import { useEffect, useState } from "react";
import { AssistantConversation } from "@/components/assistant/assistant-conversation";

/**
 * L'assistant du CRM — panneau latéral droit.
 *
 * Il se glisse PAR-DESSUS l'écran courant sans le décaler : c'est le seul
 * placement où la fiche d'un lead et ce que l'assistant en dit tiennent dans le
 * même regard. Choisi sur maquettes contre la barre ⌘K, qui couvrait
 * précisément ce qu'on voulait vérifier.
 *
 * Le fil lui-même vit dans `AssistantConversation`, partagé avec la page
 * dédiée : c'est la même conversation des deux côtés.
 *
 * ⚠️ Lot 1 : LECTURE SEULE. Les outils qui écrivent viendront avec leur aperçu.
 */
export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [monte, setMonte] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
        setMonte(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    // Une question posée depuis un autre écran ouvre le panneau.
    const onAsk = () => {
      setOpen(true);
      setMonte(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("assistant:ask", onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("assistant:ask", onAsk);
    };
  }, []);

  function ouvrir() {
    setOpen(true);
    setMonte(true);
  }

  return (
    <>
      <button
        onClick={ouvrir}
        title="Assistant (⌘J)"
        aria-label="Ouvrir l'assistant"
        className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-primary text-base text-primary-foreground shadow-lg transition-transform hover:scale-105 ${
          open ? "hidden" : ""
        }`}
      >
        ✦
      </button>

      {/* Monté une fois ouvert, puis seulement CACHÉ : démonter perdrait le fil
          affiché et rechargerait l'historique à chaque ouverture. */}
      {monte && (
        <div className={open ? "" : "hidden"}>
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
              <button
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                ×
              </button>
            </div>
            <AssistantConversation />
          </aside>
        </div>
      )}
    </>
  );
}
