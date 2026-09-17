"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

/*
 * Le « bip » du téléphone, version CRM : toutes les 15 s on demande le
 * dernier message reçu ; s'il a changé depuis la dernière fois, un son et une
 * notification du navigateur (si l'équipe l'a autorisée). Monté dans la mise
 * en page du CRM : le bip vient où qu'on soit, comme sur un téléphone.
 *
 * Deux règles du navigateur à respecter : la permission ne se demande que
 * sur un clic, et le son ne joue qu'après une interaction avec la page.
 */

const INTERVALLE_MS = 15_000;

type Dernier = { leadId: string; fullName: string; content: string | null; at: string } | null;

function bip() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
    o.onended = () => ctx.close();
  } catch {
    // pas de son possible : la notification et la pastille restent
  }
}

// La permission est un état du navigateur, pas de React : on la lit comme une
// source externe. Côté serveur `Notification` n'existe pas → « indisponible ».
const abonnes = new Set<() => void>();
function lirePermission(): NotificationPermission | "indisponible" {
  return typeof Notification === "undefined" ? "indisponible" : Notification.permission;
}
function usePermission() {
  return useSyncExternalStore(
    (cb) => {
      abonnes.add(cb);
      return () => abonnes.delete(cb);
    },
    lirePermission,
    () => "indisponible" as const
  );
}

export function WhatsAppNotifier() {
  const router = useRouter();
  const dernier = useRef<string | null | undefined>(undefined); // undefined = pas encore lu
  const permission = usePermission();
  const [demande, setDemande] = useState(false);

  useEffect(() => {
    let actif = true;
    async function verifier() {
      try {
        const res = await fetch("/api/whatsapp/unread", { cache: "no-store" });
        const data = (await res.json()) as { latest?: Dernier };
        if (!actif) return;
        const d = data.latest ?? null;
        const cle = d ? `${d.leadId}:${d.at}` : null;
        // Premier passage : on mémorise sans sonner — ce n'est pas un nouveau message.
        if (dernier.current !== undefined && cle && cle !== dernier.current && d) {
          bip();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification(`WhatsApp — ${d.fullName}`, {
              body: d.content ?? "Nouveau message",
              tag: "whatsapp-" + d.leadId, // un même lead remplace sa notification précédente
            });
            n.onclick = () => {
              window.focus();
              router.push(`/whatsapp?lead=${d.leadId}`);
              n.close();
            };
          }
        }
        dernier.current = cle;
      } catch {
        // réseau absent : on réessaie au prochain tour
      }
    }
    verifier();
    const t = setInterval(verifier, INTERVALLE_MS);
    return () => {
      actif = false;
      clearInterval(t);
    };
  }, [router]);

  if (permission !== "default" || demande) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        setDemande(true);
        await Notification.requestPermission();
        abonnes.forEach((cb) => cb()); // la permission a changé : relire
      }}
      className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-background px-3 py-1.5 text-xs shadow-md hover:bg-muted"
    >
      🔔 Être prévenu des nouveaux messages, même sur un autre onglet
    </button>
  );
}
