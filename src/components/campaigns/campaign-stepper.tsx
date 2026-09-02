"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkCampaign } from "@/lib/campaigns/preflight";

/**
 * Le fil des deux écrans, repris de Kit : on écrit d'abord, on décide ensuite
 * à qui et quand. Le passage n'est pas un simple « suivant » — il vérifie que
 * l'objet n'est pas resté générique et vous renvoie en arrière si c'est le cas.
 */
export function CampaignStepper({
  campaignId,
  step,
  subject,
  content,
}: {
  campaignId: string;
  step: "rediger" | "envoyer";
  subject: string;
  content: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);

  function goToPublish() {
    // Kit arrête sur un objet resté par défaut, sans l'interdire : on peut
    // passer outre, mais on ne peut pas ne pas l'avoir vu.
    const soft = checkCampaign({ subject, content }).find(
      (c) => c.id === "subject-generic" || c.id === "subject-empty"
    );
    if (soft) {
      setAsking(soft.message);
      return;
    }
    router.push(`/campaigns/${campaignId}?etape=envoyer`);
  }

  return (
    <>
      <div className="flex items-center gap-2 text-xs">
        <Step n={1} label="Rédiger" active={step === "rediger"} done={step === "envoyer"} />
        <span aria-hidden className="text-muted-foreground/50">›</span>
        <Step n={2} label="Envoyer" active={step === "envoyer"} done={false} />

        <div className="ml-auto">
          {step === "rediger" ? (
            <button
              onClick={goToPublish}
              className="rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-medium text-background hover:bg-foreground/90"
            >
              Continuer →
            </button>
          ) : (
            <Link
              href={`/campaigns/${campaignId}`}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              ← Revenir au contenu
            </Link>
          )}
        </div>
      </div>

      {asking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAsking(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-foreground">{asking}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              C&apos;est la première chose que verra le destinataire dans sa boîte.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAsking(null)}
                className="flex-1 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background hover:bg-foreground/90"
              >
                Changer l&apos;objet
              </button>
              <button
                onClick={() => {
                  // Fermer AVANT de naviguer : `router.push` ne démonte pas ce
                  // composant, la fenêtre restait ouverte par-dessus l'étape 2.
                  setAsking(null);
                  router.push(`/campaigns/${campaignId}?etape=envoyer`);
                }}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"
              >
                Continuer quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Step({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
        active
          ? "bg-foreground text-background"
          : done
            ? "text-foreground"
            : "text-muted-foreground/60"
      }`}
    >
      <span aria-hidden className="font-mono text-[10px]">
        {done ? "✓" : n}
      </span>
      {label}
    </span>
  );
}
