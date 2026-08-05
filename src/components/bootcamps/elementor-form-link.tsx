"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listElementorFormsAction,
  linkElementorFormAction,
  unlinkElementorFormAction,
} from "@/app/actions";

type LinkedSource = {
  id: string;
  name: string;
  elementorFormId: string | null;
  lastSubmissionId: number | null;
};

type RemoteForm = { id: string; label: string; takenBy: string | null };

export function ElementorFormLink({
  bootcampId,
  linked,
}: {
  bootcampId: string;
  linked: LinkedSource[];
}) {
  const [forms, setForms] = useState<RemoteForm[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listElementorFormsAction().then((res) => {
      setForms(res.forms);
      setLoadError(res.ok ? null : res.message);
      setLoading(false);
    });
  }, []);

  function link() {
    const form = forms.find((f) => f.id === selected);
    if (!form) return;
    startTransition(async () => {
      const res = await linkElementorFormAction(bootcampId, form.id, form.label);
      setFeedback(res);
      if (res.ok) setSelected("");
    });
  }

  function unlink(sourceId: string) {
    startTransition(async () => {
      setFeedback(await unlinkElementorFormAction(sourceId, bootcampId));
    });
  }

  return (
    <div className="space-y-3">
      {linked.length > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          ⚠️ Lien enregistré, mais l&apos;import automatique n&apos;est pas encore
          branché : les nouvelles soumissions ne deviennent pas encore des leads.
        </p>
      )}

      {linked.length > 0 && (
        <div className="space-y-2">
          {linked.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {s.elementorFormId}
                  {s.lastSubmissionId
                    ? ` · reprise après la soumission #${s.lastSubmissionId}`
                    : " · aucune soumission au moment du lien"}
                </p>
              </div>
              <button
                onClick={() => unlink(s.id)}
                disabled={isPending}
                className="ml-3 shrink-0 rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40"
              >
                Délier
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Lecture des formulaires du site…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{loadError}</p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/30"
          >
            <option value="">Choisir un formulaire Elementor…</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id} disabled={!!f.takenBy}>
                {f.label}
                {f.takenBy ? ` — déjà lié à ${f.takenBy}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={link}
            disabled={isPending || !selected}
            className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-40"
          >
            Lier
          </button>
        </div>
      )}

      {feedback && (
        <p
          className={`rounded-lg px-3 py-2 text-xs ${
            feedback.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
