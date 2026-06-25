"use client";

import { useTransition } from "react";
import { createNoteAction } from "@/app/actions";
import {
  NewEntityButton,
  FormField,
  SubmitButtons,
} from "@/components/form";

export function NewNoteButton({
  referenceType,
  referenceId,
}: {
  referenceType?: string;
  referenceId?: string;
} = {}) {
  const [isPending, startTransition] = useTransition();

  return (
    <NewEntityButton label="New Note" title="Nouvelle note">
      {(close) => (
        <form
          action={(formData) =>
            startTransition(async () => {
              await createNoteAction(formData);
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
          <FormField label="Titre">
            <input
              name="title"
              placeholder="Titre optionnel"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </FormField>
          <FormField label="Contenu *">
            <textarea
              name="content"
              required
              rows={5}
              placeholder="Votre note..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </FormField>
          <SubmitButtons
            isPending={isPending}
            createLabel="Créer la note"
            onCancel={close}
          />
        </form>
      )}
    </NewEntityButton>
  );
}
