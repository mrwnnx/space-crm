"use client";

import { useEffect, useRef, useState } from "react";
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
// Le bouton se déplace à la main (il cachait parfois ce qu'on lisait). Sa
// place est comptée depuis le coin bas-droit et gardée dans ce navigateur.
const CLE_POSITION = "assistant-bouton-position";
const TAILLE = 44; // h-11 / w-11
const MARGE = 8;
const DEFAUT = { right: 20, bottom: 20 };

function dansLEcran(p: { right: number; bottom: number }) {
  return {
    right: Math.min(Math.max(p.right, MARGE), window.innerWidth - TAILLE - MARGE),
    bottom: Math.min(Math.max(p.bottom, MARGE), window.innerHeight - TAILLE - MARGE),
  };
}

export function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [monte, setMonte] = useState(false);
  const [pos, setPos] = useState(DEFAUT);
  // Où le doigt s'est posé : au-delà de 5 px c'est un déplacement, pas un clic.
  const glisse = useRef<{ x: number; y: number; depart: typeof DEFAUT; bouge: boolean } | null>(null);

  useEffect(() => {
    try {
      const lu = JSON.parse(localStorage.getItem(CLE_POSITION) || "null");
      if (typeof lu?.right === "number" && typeof lu?.bottom === "number") setPos(dansLEcran(lu));
    } catch {
      // stockage indisponible : place par défaut
    }
    // Fenêtre rétrécie : le bouton ne doit jamais sortir de l'écran.
    const onResize = () => setPos((p) => dansLEcran(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function poser(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    glisse.current = { x: e.clientX, y: e.clientY, depart: pos, bouge: false };
  }

  function deplacer(e: React.PointerEvent<HTMLButtonElement>) {
    const g = glisse.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.bouge && Math.hypot(dx, dy) < 5) return;
    g.bouge = true;
    setPos(dansLEcran({ right: g.depart.right - dx, bottom: g.depart.bottom - dy }));
  }

  function lacher() {
    const g = glisse.current;
    glisse.current = null;
    if (!g) return;
    if (!g.bouge) return ouvrir();
    try {
      localStorage.setItem(CLE_POSITION, JSON.stringify(pos));
    } catch {
      // tant pis : la place tient jusqu'au prochain chargement
    }
  }

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
        onPointerDown={poser}
        onPointerMove={deplacer}
        onPointerUp={lacher}
        onPointerCancel={() => (glisse.current = null)}
        // Clavier (Entrée / Espace) : pas de pointeur, on ouvre directement.
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ouvrir();
          }
        }}
        title="Assistant (⌘J) — glisser pour déplacer"
        aria-label="Ouvrir l'assistant"
        style={{ right: pos.right, bottom: pos.bottom }}
        className={`fixed z-40 grid h-11 w-11 cursor-grab touch-none select-none place-items-center rounded-full bg-primary text-base text-primary-foreground shadow-lg transition-transform hover:scale-105 active:cursor-grabbing ${
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
                <p className="text-[12.5px] text-muted-foreground">
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
