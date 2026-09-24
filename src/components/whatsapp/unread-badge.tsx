"use client";

import { useEffect, useState } from "react";

// La pastille « WhatsApp » du menu : combien de conversations attendent une
// lecture. Même rythme que la cloche des notifications.
export function WhatsAppUnreadBadge() {
  const [n, setN] = useState(0);

  useEffect(() => {
    let actif = true;
    async function lire() {
      try {
        const res = await fetch("/api/whatsapp/unread", { cache: "no-store" });
        const data = (await res.json()) as { unread?: number };
        if (actif) setN(data.unread ?? 0);
      } catch {
        // le menu ne doit jamais casser pour une pastille
      }
    }
    lire();
    // Onglet caché : la pastille ne se voit pas, inutile de la relire.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") lire();
    }, 30000);
    function auRetour() {
      if (document.visibilityState === "visible") lire();
    }
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      actif = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, []);

  if (n === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[12px] font-semibold leading-none text-primary-foreground">
      {n}
    </span>
  );
}
