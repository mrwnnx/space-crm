"use client";

import { useState, useTransition } from "react";
import { updateDealFieldAction } from "@/app/actions";
import { cn } from "@/lib/utils";

export function DealSidePanel({
  dealId,
  deal,
}: {
  dealId: string;
  deal: {
    dealValue: string | null;
    probability: string | null;
    nextStep: string | null;
    expectedClosureDate: Date | string | null;
    lostNotes: string | null;
  };
}) {
  return (
    <div className="flex flex-col gap-0.5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Deal
      </p>
      <EditableField
        leadId={dealId}
        field="dealValue"
        label="Deal value"
        value={deal.dealValue ? String(deal.dealValue) : ""}
        type="number"
        prefix="€"
      />
      <EditableField
        leadId={dealId}
        field="probability"
        label="Probabilité"
        value={deal.probability ? String(deal.probability) : ""}
        type="number"
        suffix="%"
      />
      <EditableField
        leadId={dealId}
        field="nextStep"
        label="Prochaine étape"
        value={deal.nextStep || ""}
      />
      <EditableField
        leadId={dealId}
        field="expectedClosureDate"
        label="Closure prévue"
        value={deal.expectedClosureDate ? String(deal.expectedClosureDate).slice(0, 10) : ""}
        type="date"
      />
    </div>
  );
}

function EditableField({
  leadId,
  field,
  label,
  value,
  type = "text",
  prefix,
  suffix,
}: {
  leadId: string;
  field: string;
  label: string;
  value: string;
  type?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [isPending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (val !== value) {
      startTransition(() => updateDealFieldAction(leadId, field, val));
    }
  }

  return (
    <div
      className="group -mx-2 flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
      onClick={() => !editing && setEditing(true)}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      {editing ? (
        <input
          type={type}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
          autoFocus
          className="w-40 rounded border border-ring bg-background px-2 py-0.5 text-xs text-foreground outline-none"
        />
      ) : (
        <span
          className={cn(
            "text-xs font-medium",
            value ? "text-foreground" : "text-muted-foreground/50"
          )}
        >
          {value ? `${prefix || ""}${value}${suffix || ""}` : "—"}
        </span>
      )}
    </div>
  );
}
