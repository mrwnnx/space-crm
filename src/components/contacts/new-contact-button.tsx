"use client";

import { useTransition } from "react";
import { createContactAction } from "@/app/actions";
import {
  NewEntityButton,
  FormField,
  Input,
  Select,
  SubmitButtons,
} from "@/components/form";
import type { Organization } from "@/db/schema";

export function NewContactButton({
  organizations,
}: {
  organizations: Organization[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <NewEntityButton label="New Contact" title="Nouveau contact">
      {(close) => (
        <form
          action={(formData) =>
            startTransition(async () => {
              await createContactAction(formData);
              close();
            })
          }
          className="space-y-3"
        >
          <FormField label="Nom complet *">
            <Input name="fullName" required placeholder="Marwen Trabelsi" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email">
              <Input name="email" type="email" placeholder="marwen@email.com" />
            </FormField>
            <FormField label="Mobile">
              <Input name="mobileNo" placeholder="+216 22 333 444" />
            </FormField>
          </div>
          <FormField label="Organisation">
            <Select name="organizationId">
              <option value="">—</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </FormField>
          <SubmitButtons
            isPending={isPending}
            createLabel="Créer le contact"
            onCancel={close}
          />
        </form>
      )}
    </NewEntityButton>
  );
}
