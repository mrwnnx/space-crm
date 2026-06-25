"use client";

import { useTransition } from "react";
import { createTaskAction } from "@/app/actions";
import {
  NewEntityButton,
  FormField,
  Input,
  Select,
  SubmitButtons,
} from "@/components/form";

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function NewTaskButton({
  referenceType,
  referenceId,
}: {
  referenceType?: string;
  referenceId?: string;
} = {}) {
  const [isPending, startTransition] = useTransition();

  return (
    <NewEntityButton label="New Task" title="Nouvelle tâche">
      {(close) => (
        <form
          action={(formData) =>
            startTransition(async () => {
              await createTaskAction(formData);
              close();
            })
          }
          className="space-y-3"
        >
          {referenceType && (
            <input type="hidden" name="referenceType" value={referenceType} />
          )}
          {referenceId && (
            <input type="hidden" name="referenceId" value={referenceId} />
          )}
          <FormField label="Titre *">
            <Input name="title" required placeholder="Appeler le lead" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priorité">
              <Select name="priority">
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Échéance">
              <Input name="dueDate" type="datetime-local" />
            </FormField>
          </div>
          <FormField label="Assigné à">
            <Input name="assignedTo" placeholder="Email ou nom" />
          </FormField>
          <FormField label="Description">
            <textarea
              name="description"
              rows={3}
              placeholder="Description optionnelle"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </FormField>
          <SubmitButtons
            isPending={isPending}
            createLabel="Créer la tâche"
            onCancel={close}
          />
        </form>
      )}
    </NewEntityButton>
  );
}
