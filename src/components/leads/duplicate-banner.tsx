"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { DuplicateInfo } from "@/lib/duplicates";
import { dismissDuplicateAction, separateLeadAction } from "@/app/actions";
import { formatDate } from "@/lib/utils";

export function DuplicateBanner({
  leadId,
  info,
}: {
  leadId: string;
  info: DuplicateInfo;
}) {
  const [hidden, setHidden] = useState(info.dismissed);
  const [error, setError] = useState<string | null>(null);
  const [confirmSplit, setConfirmSplit] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (hidden) return null;

  // Noms identiques = ré-inscription, information neutre.
  // Noms différents = deux personnes peut-être confondues, à vérifier.
  const suspect = info.nameDiffers;
  const sharesContact = info.others.some((o) => o.sameContact);

  return (
    <div
      className={`mx-4 mt-4 rounded-lg border px-3 py-2.5 ${
        suspect
          ? "border-amber-200 bg-amber-50"
          : "border-border bg-muted/40"
      }`}
    >
      <p className={`text-xs font-medium ${suspect ? "text-amber-900" : "text-foreground"}`}>
        {suspect
          ? "Cette adresse est utilisée par un autre nom"
          : "Cette personne a déjà une autre inscription"}
      </p>

      <ul className="mt-1.5 space-y-1">
        {info.others.map((o) => (
          <li key={o.id} className="text-xs text-muted-foreground">
            <Link
              href={`/leads/${o.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {o.fullName}
            </Link>
            {o.bootcampName && ` — ${o.bootcampName}`}
            {" · "}
            {formatDate(o.createdAt)}
            {o.converted && " · inscrit"}
          </li>
        ))}
      </ul>

      {sharesContact && suspect && (
        <p className="mt-1.5 text-xs text-amber-800">
          Les deux fiches partagent un seul contact&nbsp;: une campagne n&apos;en
          touchera qu&apos;une, et leurs revenus sont comptés ensemble.
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {!confirmSplit ? (
          <>
            <button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  await dismissDuplicateAction(leadId);
                  setHidden(true);
                });
              }}
              disabled={isPending}
              className="text-xs font-medium text-foreground underline hover:no-underline disabled:opacity-50"
            >
              C&apos;est la même personne
            </button>

            {sharesContact && (
              <button
                onClick={() => setConfirmSplit(true)}
                className="text-xs font-medium text-foreground underline hover:no-underline"
              >
                Ce sont deux personnes
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Donner à cette fiche son propre contact&nbsp;?
            </span>
            <button
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await separateLeadAction(leadId);
                  if (r.ok) setHidden(true);
                  else setError(r.error ?? "Échec de la séparation");
                  setConfirmSplit(false);
                });
              }}
              disabled={isPending}
              className="text-xs font-medium text-foreground underline hover:no-underline disabled:opacity-50"
            >
              {isPending ? "Séparation…" : "Oui, séparer"}
            </button>
            <button
              onClick={() => setConfirmSplit(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
}
