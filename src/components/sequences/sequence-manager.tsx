"use client";

import { useState, useTransition } from "react";
import { createSequence, toggleSequenceStatus } from "@/app/actions";
import { cn } from "@/lib/utils";
import type { Sequence, SequenceStep } from "@/db/schema";

type Step = {
  channel: "email" | "whatsapp" | "sms";
  delayDays: number;
  subject: string;
  content: string;
};

export function SequenceManager({
  sequences: existingSequences,
}: {
  sequences: (Sequence & { steps: SequenceStep[] })[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      {existingSequences.map((seq) => (
        <div
          key={seq.id}
          className="rounded-lg border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">
                {seq.name}
              </h3>
              {seq.description && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {seq.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  seq.status === "active"
                    ? "bg-green-50 text-green-600"
                    : seq.status === "paused"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-slate-100 text-slate-500"
                )}
              >
                {seq.status === "active"
                  ? "Active"
                  : seq.status === "paused"
                    ? "En pause"
                    : "Brouillon"}
              </span>
              {seq.status !== "draft" && (
                <ToggleStatusButton sequenceId={seq.id} />
              )}
            </div>
          </div>

          {seq.steps.length > 0 && (
            <div className="mt-3 space-y-2">
              {seq.steps
                .sort((a, b) => a.order - b.order)
                .map((step, i) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                      {i + 1}
                    </span>
                    <span className="font-medium capitalize text-slate-600">
                      {step.channel}
                    </span>
                    <span className="text-slate-400">
                      {step.delayDays === 0
                        ? "Immédiat"
                        : `J+${step.delayDays}`}
                    </span>
                    <span className="truncate text-slate-500">
                      {step.subject ?? step.content.slice(0, 60) + "..."}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}

      {showForm ? (
        <CreateSequenceForm onCancel={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-lg border-2 border-dashed border-slate-200 py-3 text-sm text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
        >
          + Créer une séquence
        </button>
      )}
    </div>
  );
}

function ToggleStatusButton({ sequenceId }: { sequenceId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => toggleSequenceStatus(sequenceId))}
      className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
    >
      {isPending ? "..." : "Activer/Pause"}
    </button>
  );
}

function CreateSequenceForm({ onCancel }: { onCancel: () => void }) {
  const [steps, setSteps] = useState<Step[]>([
    { channel: "whatsapp", delayDays: 0, subject: "", content: "" },
  ]);
  const [isPending, startTransition] = useTransition();

  function addStep() {
    setSteps([
      ...steps,
      { channel: "email", delayDays: 3, subject: "", content: "" },
    ]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof Step, value: string | number) {
    setSteps(
      steps.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    steps.forEach((step, i) => {
      formData.set(`step_${i + 1}_channel`, step.channel);
      formData.set(`step_${i + 1}_delay_days`, String(step.delayDays));
      formData.set(`step_${i + 1}_subject`, step.subject);
      formData.set(`step_${i + 1}_content`, step.content);
    });

    startTransition(() => createSequence(formData));
    onCancel();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-4"
    >
      <div className="space-y-3">
        <input
          type="text"
          name="name"
          required
          placeholder="Nom (ex: Relance ancien cohort)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <input
          type="text"
          name="description"
          placeholder="Description (optionnel)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <input type="hidden" name="trigger" value="manual" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600">Étapes</p>
        {steps.map((step, i) => (
          <div
            key={i}
            className="space-y-2 rounded-lg border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                {i + 1}
              </span>
              <select
                value={step.channel}
                onChange={(e) => updateStep(i, "channel", e.target.value)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">J+</span>
                <input
                  type="number"
                  min="0"
                  value={step.delayDays}
                  onChange={(e) =>
                    updateStep(i, "delayDays", Number(e.target.value))
                  }
                  className="w-14 rounded-md border border-slate-200 px-2 py-1 text-xs"
                />
              </div>
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="ml-auto text-xs text-red-400 hover:text-red-600"
                >
                  Retirer
                </button>
              )}
            </div>
            {step.channel === "email" && (
              <input
                type="text"
                value={step.subject}
                onChange={(e) => updateStep(i, "subject", e.target.value)}
                placeholder="Sujet"
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
            )}
            <textarea
              value={step.content}
              onChange={(e) => updateStep(i, "content", e.target.value)}
              placeholder="Contenu du message..."
              rows={2}
              className="w-full resize-none rounded-md border border-slate-200 px-2 py-1 text-xs"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addStep}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          + Ajouter une étape
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? "Création..." : "Créer la séquence"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
