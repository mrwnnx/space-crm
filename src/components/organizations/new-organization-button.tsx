"use client";

import { useTransition } from "react";
import { createOrganizationAction } from "@/app/actions";
import {
  NewEntityButton,
  FormField,
  Input,
  Select,
  SubmitButtons,
} from "@/components/form";
import type { Industry, Territory } from "@/db/schema";

const EMPLOYEE_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

export function NewOrganizationButton({
  industries,
  territories,
}: {
  industries: Industry[];
  territories: Territory[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <NewEntityButton label="New Organization" title="Nouvelle organisation">
      {(close) => (
        <form
          action={(formData) =>
            startTransition(async () => {
              await createOrganizationAction(formData);
              close();
            })
          }
          className="space-y-3"
        >
          <FormField label="Nom *">
            <Input name="name" required placeholder="Space Academy" />
          </FormField>
          <FormField label="Website">
            <Input name="website" placeholder="https://spaceacademy.com" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Industrie">
              <Select name="industryId">
                <option value="">—</option>
                {industries.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Territoire">
              <Select name="territoryId">
                <option value="">—</option>
                {territories.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Revenue annuel">
              <Input name="annualRevenue" placeholder="100000" />
            </FormField>
            <FormField label="Employés">
              <Select name="noOfEmployees">
                <option value="">—</option>
                {EMPLOYEE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <SubmitButtons
            isPending={isPending}
            createLabel="Créer l'organisation"
            onCancel={close}
          />
        </form>
      )}
    </NewEntityButton>
  );
}
