"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markEcheancePaidAction } from "@/app/actions";
import { PaymentMethodPicker } from "@/components/leads/payment-method-picker";

/**
 * Encaisser une échéance : qui a reçu l'argent, et la preuve.
 *
 * Pointer une échéance était une case à cocher. Ça reste un geste, mais il
 * demande maintenant les deux informations qui manquaient le jour où l'argent
 * ne se retrouve pas : chez QUI il est, et QUOI le prouve.
 *
 * Le justificatif reste facultatif — un paiement en espèces n'a pas de reçu de
 * virement, et l'exiger bloquerait le cas le plus fréquent.
 */
export function CollectPaymentDialog({
  echeanceId,
  amount,
  currency,
  team,
  onClose,
}: {
  echeanceId: string;
  amount: string | null;
  currency: string;
  /** Les membres de l'équipe : c'est la liste fermée du « chez qui ». */
  team: { email: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [method, setMethod] = useState("");

  /**
   * Un virement arrive sur le compte, pas dans la poche de quelqu'un : choisir
   * « Virement » propose le compte bancaire. Proposé, pas imposé — on peut
   * virer sur un compte personnel.
   */
  function pickMethod(v: string) {
    setMethod(v);
    if (v === "virement" && !receivedBy) setReceivedBy("banque");
    if (v !== "virement" && receivedBy === "banque") setReceivedBy("");
  }
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("echeanceId", echeanceId);
    fd.set("receivedBy", receivedBy);
    fd.set("method", method);
    const f = fileRef.current?.files?.[0];
    if (f) fd.set("proof", f);

    startTransition(async () => {
      const res = await markEcheancePaidAction(fd);
      if ("error" in res && res.error) return setError(res.error);
      // Un justificatif qui n'est pas parti ne doit pas passer inaperçu : le
      // paiement, lui, est bien enregistré.
      if ("warning" in res && res.warning) return setError(res.warning);
      router.refresh();
      onClose();
    });
  }

  const FIELD =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">Encaisser cette échéance</h2>
        {amount && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {Number(amount).toLocaleString("fr-FR")} {currency}
          </p>
        )}

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Moyen de paiement
            </label>
            <PaymentMethodPicker value={method} onChange={pickMethod} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Encaissé par
            </label>
            <select
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              autoFocus
              className={FIELD}
            >
              <option value="">— à préciser —</option>
              <option value="banque">Compte bancaire (virement)</option>
              {team.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Justificatif <span className="font-normal">(facultatif)</span>
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              {fileName ?? "Choisir un fichier — photo du reçu ou PDF"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/heic,image/webp,application/pdf"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="hidden"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              10 Mo maximum. Le fichier reste privé : il ne s&apos;ouvre que depuis le CRM.
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-[11px] font-medium text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={isPending}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "…" : "Enregistrer l'encaissement"}
          </button>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
