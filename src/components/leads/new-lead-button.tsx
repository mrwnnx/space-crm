"use client";

import { useState, useTransition } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { createLeadAction } from "@/app/actions";
import type { LeadSource } from "@/db/schema";

export function NewLeadButton({
  sources,
  bootcamps,
  lockedBootcamp,
}: {
  sources: LeadSource[];
  bootcamps?: { id: string; label: string }[];
  lockedBootcamp?: { id: string; name: string };
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createLeadAction(formData);
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <HugeiconsIcon icon={Add01Icon} size={14} />
        New Lead
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground font-heading">
              Nouveau lead
            </h2>
            <form action={handleSubmit} className="space-y-3">
              {lockedBootcamp ? (
                <div>
                  <Label>Formation</Label>
                  <input type="hidden" name="bootcampId" value={lockedBootcamp.id} />
                  <div className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {lockedBootcamp.name}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Formation *</Label>
                  <Select name="bootcampId" required defaultValue="">
                    <option value="" disabled>
                      — Choisir une formation —
                    </option>
                    {(bootcamps ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prénom *</Label>
                  <Input name="firstName" required placeholder="Marwen" />
                </div>
                <div>
                  <Label>Nom</Label>
                  <Input name="lastName" placeholder="Trabelsi" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="marwen@email.com" />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input name="mobileNo" placeholder="+216 22 333 444" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>WhatsApp</Label>
                  <Input name="whatsapp" placeholder="+216 22 333 444" />
                </div>
                <div>
                  <Label>Âge</Label>
                  <Input name="age" type="number" placeholder="25" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Offre</Label>
                  <Select name="intendedPlan">
                    <option value="">—</option>
                    <option value="total">Comptant</option>
                    <option value="monthly">Facilité</option>
                  </Select>
                </div>
                <div>
                  <Label>Code promo</Label>
                  <Input name="promoCode" placeholder="EARLYBIRD" />
                </div>
              </div>
              <div>
                <Label>Source</Label>
                <Select name="sourceId">
                  <option value="">—</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>

              {error && (
                <p className="text-xs font-medium text-red-600">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isPending ? "Création..." : "Créer le lead"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-xs font-medium text-muted-foreground">
      {children}
    </label>
  );
}

function Input({
  name,
  type = "text",
  required,
  placeholder,
}: {
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      name={name}
      type={type}
      required={required}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    />
  );
}

function Select({
  name,
  children,
  required,
  defaultValue,
}: {
  name: string;
  children: React.ReactNode;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {children}
    </select>
  );
}
