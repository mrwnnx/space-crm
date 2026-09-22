"use client";

import { useState, useTransition } from "react";
import { useTeamProfiles } from "@/components/team-profiles";
import { useRouter } from "next/navigation";
import { markEcheanceUnpaidAction, getProofUrlAction, updateEcheanceAmountAction } from "@/app/actions";
import { OfferDialog } from "@/components/leads/offer-dialog";
import { CollectPaymentDialog } from "@/components/leads/collect-payment-dialog";
import { METHOD_LABEL } from "@/components/leads/payment-method-picker";
import { cn, formatDate } from "@/lib/utils";

type Echeance = {
  id: string;
  dueDate: string | null;
  amount: string | null;
  isPaid: boolean;
  paidAt: Date | null;
  /** Email d'un membre de l'équipe, ou 'banque'. */
  receivedBy: string | null;
  /** 'especes' | 'virement' | 'cheque' */
  method: string | null;
  proofName: string | null;
};


type Summary = {
  total: number;
  paidCount: number;
  count: number;
  status: "paid" | "on_track" | "overdue";
};

const statusConfig: Record<
  string,
  { label: string; style: string }
> = {
  paid: {
    label: "Soldé",
    style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  on_track: {
    label: "À jour",
    style: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  overdue: {
    label: "En retard",
    style: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export function PaymentBlock({
  leadId,
  items,
  summary,
  currency,
  team,
}: {
  leadId: string;
  items: Echeance[];
  summary: Summary;
  currency?: string | null;
  team: { email: string }[];
}) {
  const { resolve } = useTeamProfiles();
  // « banque » n'est pas une personne ; un email devient le nom du profil.
  const personne = (value: string) =>
    value === "banque" ? "compte bancaire" : resolve(value).name;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // L'échéance en cours d'encaissement : cocher ouvre une fenêtre, décocher non.
  const [collecting, setCollecting] = useState<Echeance | null>(null);
  // Le montant qu'on est en train de corriger (erreur de saisie, remboursement).
  const [corrige, setCorrige] = useState<{ id: string; valeur: string } | null>(null);

  function enregistrerMontant() {
    if (!corrige) return;
    const v = Number(corrige.valeur.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return setCorrige(null);
    // Le champ reste affiché, figé, jusqu'au rafraîchissement : sinon on
    // revoit l'ancien montant pendant deux secondes et on croit que ça a raté.
    startTransition(async () => {
      await updateEcheanceAmountAction(corrige.id, v);
      router.refresh();
      setCorrige(null);
    });
  }

  function toggle(ech: Echeance) {
    // Décocher est une correction de clic : ça ne demande rien et ça ne détruit
    // pas le justificatif déjà déposé.
    if (ech.isPaid) {
      startTransition(async () => {
        await markEcheanceUnpaidAction(ech.id);
        router.refresh();
      });
      return;
    }
    setCollecting(ech);
  }

  /** Le lien de lecture est fabriqué au clic, jamais posé dans la page. */
  function openProof(echeanceId: string) {
    startTransition(async () => {
      const res = await getProofUrlAction(echeanceId);
      if ("url" in res && res.url) window.open(res.url, "_blank", "noopener,noreferrer");
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [editing, setEditing] = useState(false);
  // Ce qui est encaissé : c'est le plancher du nouveau total.
  const paidAmount = items
    .filter((e) => e.isPaid)
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Paiement
        </p>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[12px] font-medium",
            statusConfig[summary.status]?.style
          )}
        >
          {statusConfig[summary.status]?.label}
        </span>
      </div>

      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">
          {summary.paidCount} / {summary.count} payées
          {summary.total > 0 && ` · total ${summary.total.toLocaleString("fr-FR")} ${currency ?? "TND"}`}
        </p>
        {/* La négociation ne s'arrête pas à l'inscription : sans ce bouton,
            une remise accordée après coup ne pouvait plus être enregistrée. */}
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-[13px] text-muted-foreground underline hover:text-foreground"
        >
          Modifier l&apos;offre
        </button>
      </div>

      {editing && (
        <OfferDialog
          leadId={leadId}
          currency={currency ?? "TND"}
          current={{ plan: null, total: String(summary.total || ""), count: items.length, amount: null }}
          enrolled
          paid={paidAmount}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="space-y-1">
        {items.map((ech) => {
          const due = ech.dueDate ? new Date(ech.dueDate) : null;
          const overdue = !ech.isPaid && due && due < today;

          return (
            <div
              key={ech.id}
              className={cn(
                "rounded-md px-2 py-1.5 transition-colors",
                overdue ? "bg-red-500/5" : "hover:bg-muted/40"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ech.isPaid}
                  disabled={isPending}
                  onChange={() => toggle(ech)}
                  className="h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className={cn("text-xs", overdue && "font-medium text-red-500")}>
                    {ech.dueDate ? formatDate(ech.dueDate) : "—"}
                  </span>
                  {corrige?.id === ech.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={corrige.valeur}
                        onChange={(e) => setCorrige({ id: ech.id, valeur: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") enregistrerMontant();
                          if (e.key === "Escape") setCorrige(null);
                        }}
                        onBlur={enregistrerMontant}
                        disabled={isPending}
                        inputMode="decimal"
                        className="w-20 rounded border border-ring bg-background px-1.5 py-0.5 text-right text-xs outline-none disabled:opacity-60"
                      />
                      <span className="text-[12px] text-muted-foreground">{currency ?? "TND"}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setCorrige({ id: ech.id, valeur: ech.amount ?? "" })}
                      title="Corriger le montant"
                      className="rounded px-1 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      {ech.amount ? `${Number(ech.amount).toLocaleString("fr-FR")} ${currency ?? "TND"}` : "—"}
                    </button>
                  )}
                </div>
                {ech.paidAt && (
                  <span className="shrink-0 text-[12px] text-emerald-600 dark:text-emerald-400">
                    payée
                  </span>
                )}
              </div>

              {/* Une échéance encaissée dit où est l'argent et ce qui le prouve.
                  Le manque s'affiche aussi : c'est ce qui permet de rattraper. */}
              {ech.isPaid && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-[22px] text-[12px] text-muted-foreground">
                  <span title={ech.receivedBy ?? undefined}>
                    {ech.receivedBy ? `chez ${personne(ech.receivedBy)}` : "détenteur non précisé"}
                  </span>
                  {ech.method && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{METHOD_LABEL[ech.method] ?? ech.method}</span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  {ech.proofName ? (
                    <button
                      onClick={() => openProof(ech.id)}
                      disabled={isPending}
                      className="underline hover:text-foreground disabled:opacity-50"
                      title={ech.proofName}
                    >
                      justificatif
                    </button>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-500">sans justificatif</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {collecting && (
        <CollectPaymentDialog
          echeanceId={collecting.id}
          amount={collecting.amount}
          currency={currency ?? "TND"}
          team={team}
          onClose={() => setCollecting(null)}
        />
      )}
    </div>
  );
}
