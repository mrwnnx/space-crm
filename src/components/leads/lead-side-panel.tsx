"use client";

import { useState, useTransition } from "react";
import { updateLeadFieldAction, updateLeadContactFieldAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import type { LeadSource, Bootcamp } from "@/db/schema";

type LeadData = {
  email: string | null;
  mobileNo: string | null;
  sourceId: string | null;
  intendedPlan: string | null;
  promoCode: string | null;
};

type ContactData = {
  whatsapp: string | null;
  age: number | null;
};

export function LeadSidePanel({
  leadId,
  lead,
  contactId,
  contact,
  sources,
  bootcamp,
}: {
  leadId: string;
  lead: LeadData;
  contactId: string | null;
  contact: ContactData;
  sources: LeadSource[];
  bootcamp?: Bootcamp | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Coordonnées
      </p>
      <EditableField
        field="email"
        label="Email"
        value={lead.email}
        type="email"
        onSave={(f, v) => updateLeadFieldAction(leadId, f, v)}
      />
      <EditableField
        field="mobileNo"
        label="Téléphone"
        value={lead.mobileNo}
        onSave={(f, v) => updateLeadFieldAction(leadId, f, v)}
      />
      {contactId && (
        <>
          <EditableField
            field="whatsapp"
            label="WhatsApp"
            value={contact.whatsapp}
            onSave={(f, v) => updateLeadContactFieldAction(leadId, contactId, f, v)}
          />
          <EditableField
            field="age"
            label="Âge"
            type="number"
            value={contact.age != null ? String(contact.age) : null}
            onSave={(f, v) => updateLeadContactFieldAction(leadId, contactId, f, v)}
          />
        </>
      )}

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Classification
      </p>
      <EditableSelect
        leadId={leadId}
        field="sourceId"
        label="Source"
        value={lead.sourceId}
        options={sources.map((s) => ({ value: s.id, label: s.name }))}
      />

      {bootcamp && (
        <EditableSelect
          leadId={leadId}
          field="intendedPlan"
          label="Offre envisagée"
          value={lead.intendedPlan}
          options={[
            ...(bootcamp.priceTotal ? [{ value: "total", label: `Comptant — ${bootcamp.priceTotal} ${bootcamp.currency}` }] : []),
            ...(bootcamp.monthlyCount && bootcamp.monthlyAmount ? [{ value: "monthly", label: `Facilité — ${bootcamp.monthlyCount}× ${bootcamp.monthlyAmount} ${bootcamp.currency}` }] : []),
          ]}
        />
      )}
      <EditableField
        field="promoCode"
        label="Code promo"
        value={lead.promoCode}
        onSave={(f, v) => updateLeadFieldAction(leadId, f, v)}
      />
    </div>
  );
}

function EditableField({
  field,
  label,
  value,
  type = "text",
  onSave,
}: {
  field: string;
  label: string;
  value: string | null;
  type?: string;
  onSave: (field: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const [, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (val !== (value || "")) {
      startTransition(() => onSave(field, val));
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
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function EditableSelect({
  leadId,
  field,
  label,
  value,
  options,
}: {
  leadId: string;
  field: string;
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  function change(newVal: string) {
    if (newVal !== (value || "")) {
      startTransition(() => updateLeadFieldAction(leadId, field, newVal));
    }
  }

  return (
    <div className="-mx-2 flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={value || ""}
        onChange={(e) => change(e.target.value)}
        className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-foreground outline-none hover:border-border"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
