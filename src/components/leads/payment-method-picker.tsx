"use client";

/**
 * Comment l'argent est arrivé.
 *
 * Trois boutons plutôt qu'un menu : le choix se voit d'un coup d'œil, et il y
 * a exactement trois cas en Tunisie. Partagé entre la fenêtre d'encaissement
 * et celle d'inscription — les deux posent la même question.
 */
export const PAYMENT_METHODS = [
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Chèque" },
] as const;

export const METHOD_LABEL: Record<string, string> = {
  especes: "espèces",
  virement: "virement",
  cheque: "chèque",
};

export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onChange(value === m.value ? "" : m.value)}
          className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
            value === m.value
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
