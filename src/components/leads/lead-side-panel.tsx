"use client";

import { useState, useTransition } from "react";
import { updateLeadFieldAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import type { LeadSource, Industry, Bootcamp } from "@/db/schema";

type LeadData = {
  email: string | null;
  mobileNo: string | null;
  phone: string | null;
  website: string | null;
  jobTitle: string | null;
  organizationName: string | null;
  sourceId: string | null;
  industryId: string | null;
  intendedPlan: string | null;
};

export function LeadSidePanel({
  leadId,
  lead,
  sources,
  industries,
  bootcamp,
}: {
  leadId: string;
  lead: LeadData;
  sources: LeadSource[];
  industries: Industry[];
  bootcamp?: Bootcamp | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Coordonnées
      </p>
      <EditableField
        leadId={leadId}
        field="email"
        label="Email"
        value={lead.email}
        type="email"
      />
      <EditableField
        leadId={leadId}
        field="mobileNo"
        label="Mobile"
        value={lead.mobileNo}
      />
      <EditableField
        leadId={leadId}
        field="phone"
        label="Téléphone"
        value={lead.phone}
      />
      <EditableField
        leadId={leadId}
        field="website"
        label="Website"
        value={lead.website}
      />
      <EditableField
        leadId={leadId}
        field="jobTitle"
        label="Job title"
        value={lead.jobTitle}
      />
      <EditableField
        leadId={leadId}
        field="organizationName"
        label="Organisation"
        value={lead.organizationName}
      />

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
      <EditableSelect
        leadId={leadId}
        field="industryId"
        label="Industrie"
        value={lead.industryId}
        options={industries.map((i) => ({ value: i.id, label: i.name }))}
      />

      {bootcamp && (
        <EditableSelect
          leadId={leadId}
          field="intendedPlan"
          label="Plan envisagé"
          value={lead.intendedPlan}
          options={[
            ...(bootcamp.priceTotal ? [{ value: "total", label: `Comptant — ${bootcamp.priceTotal} ${bootcamp.currency}` }] : []),
            ...(bootcamp.monthlyCount && bootcamp.monthlyAmount ? [{ value: "monthly", label: `Facilité — ${bootcamp.monthlyCount}× ${bootcamp.monthlyAmount} ${bootcamp.currency}` }] : []),
          ]}
        />
      )}
    </div>
  );
}

function EditableField({
  leadId,
  field,
  label,
  value,
  type = "text",
}: {
  leadId: string;
  field: string;
  label: string;
  value: string | null;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");
  const [isPending, startTransition] = useTransition();

  function save() {
    setEditing(false);
    if (val !== (value || "")) {
      startTransition(() => updateLeadFieldAction(leadId, field, val));
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
