"use client";

import { useState, useTransition } from "react";
import {
  createSequenceAction,
  addSequenceStepAction,
  setSequenceActiveAction,
  deleteSequenceAction,
  deleteSequenceStepAction,
} from "@/app/actions";
import type { SequenceRow } from "@/lib/queries";

type Stage = { id: string; name: string };
type Tag = { id: string; name: string };
type Template = { id: string; name: string; subject: string | null };

const TRIGGERS = [
  { value: "lead_created", label: "un lead arrive dans la formation" },
  { value: "enters_status", label: "un lead entre dans une colonne" },
  { value: "tag_added", label: "un tag est posé" },
] as const;

const CONDITIONS = [
  { value: "none", label: "toujours" },
  { value: "not_clicked", label: "s'il n'a pas cliqué avant" },
  { value: "clicked", label: "s'il a cliqué avant" },
  { value: "not_moved", label: "s'il n'a pas changé de colonne" },
];

const DELAYS = [
  { h: 1, label: "1 h" },
  { h: 24, label: "1 jour" },
  { h: 48, label: "2 jours" },
  { h: 72, label: "3 jours" },
  { h: 168, label: "7 jours" },
  { h: 336, label: "14 jours" },
];

const FIELD =
  "rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring";

export function SequencesManager({
  bootcampId,
  sequences,
  stages,
  tags,
  templates,
}: {
  bootcampId: string;
  sequences: SequenceRow[];
  stages: Stage[];
  tags: Tag[];
  templates: Template[];
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<(typeof TRIGGERS)[number]["value"]>("lead_created");
  const [statusId, setStatusId] = useState("");
  const [tagId, setTagId] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function create(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSequenceAction(bootcampId, {
        name,
        trigger,
        triggerStatusId: trigger === "enters_status" ? statusId : null,
        triggerTagId: trigger === "tag_added" ? tagId : null,
      });
      setFeedback(res);
      if (res.ok) {
        setName("");
        setCreating(false);
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Séquences email</p>
          <p className="text-[10px] text-muted-foreground">
            Plusieurs emails espacés, avec conditions. Une séquence{" "}
            <strong>s&apos;arrête toute seule</strong> si la personne s&apos;inscrit, se
            désabonne ou est qualifiée hors cible.
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
        >
          {creating ? "Fermer" : "+ Séquence"}
        </button>
      </div>

      {sequences.length > 0 && (
        <div className="mt-3 space-y-2">
          {sequences.map((seq) => (
            <SequenceCard
              key={seq.id}
              bootcampId={bootcampId}
              seq={seq}
              stages={stages}
              tags={tags}
              templates={templates}
            />
          ))}
        </div>
      )}

      {creating && (
        <form onSubmit={create} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
          <label className="flex-1 min-w-[150px]">
            <span className="mb-1 block text-[10px] text-muted-foreground">Nom</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Relance brochure"
              className={`w-full ${FIELD}`}
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            <span className="mb-1 block text-[10px] text-muted-foreground">Quand</span>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              className={`w-full ${FIELD}`}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {trigger === "enters_status" && (
            <select value={statusId} onChange={(e) => setStatusId(e.target.value)} className={FIELD}>
              <option value="">— colonne —</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {trigger === "tag_added" && (
            <select value={tagId} onChange={(e) => setTagId(e.target.value)} className={FIELD}>
              <option value="">— tag —</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Créer
          </button>
        </form>
      )}

      {feedback && (
        <p className={feedback.ok ? "mt-2 text-[11px] text-green-600" : "mt-2 text-[11px] text-amber-700"}>
          {feedback.message}
        </p>
      )}
    </div>
  );
}

function SequenceCard({
  bootcampId,
  seq,
  stages,
  tags,
  templates,
}: {
  bootcampId: string;
  seq: SequenceRow;
  stages: Stage[];
  tags: Tag[];
  templates: Template[];
}) {
  const [adding, setAdding] = useState(false);
  const [delay, setDelay] = useState(24);
  const [templateId, setTemplateId] = useState("");
  const [condition, setCondition] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const triggerLabel =
    seq.trigger === "enters_status"
      ? `entrée dans « ${stages.find((s) => s.id === seq.triggerStatusId)?.name ?? "?"} »`
      : seq.trigger === "tag_added"
        ? `tag « ${tags.find((t) => t.id === seq.triggerTagId)?.name ?? "?"} »`
        : "arrivée d'un lead";

  function addStep() {
    startTransition(async () => {
      const res = await addSequenceStepAction(bootcampId, seq.id, {
        delayHours: delay,
        emailTemplateId: templateId,
        condition,
      });
      setError(res.ok ? null : res.message);
      if (res.ok) {
        setTemplateId("");
        setAdding(false);
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      const res = await setSequenceActiveAction(seq.id, !seq.active, bootcampId);
      setError(res.ok ? null : res.message);
    });
  }

  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {seq.name} <span className="font-normal text-muted-foreground">· {triggerLabel}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {seq.steps.length} étape{seq.steps.length > 1 ? "s" : ""} ·{" "}
            {seq.activeCount} en cours · {seq.sentCount} envoyé
            {seq.sentCount > 1 ? "s" : ""} · {seq.clickedCount} clic
            {seq.clickedCount > 1 ? "s" : ""} · {seq.exitedCount} sorti
            {seq.exitedCount > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggle}
            className={
              seq.active
                ? "rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700"
                : "rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"
            }
          >
            {seq.active ? "Active" : "En pause"}
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-md border border-border px-2 py-1 text-[10px] hover:bg-muted"
          >
            + Étape
          </button>
          <button
            onClick={() => startTransition(() => deleteSequenceAction(seq.id, bootcampId))}
            className="rounded-md px-2 py-1 text-[10px] text-red-500 hover:bg-red-50"
          >
            Supprimer
          </button>
        </div>
      </div>

      {seq.steps.length > 0 && (
        <ol className="mt-2 space-y-1">
          {seq.steps.map((st, i) => (
            <li key={st.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="w-4 text-right">{i + 1}.</span>
              <span>
                après{" "}
                <strong className="text-foreground">
                  {st.delayHours >= 24 ? `${Math.round(st.delayHours / 24)} j` : `${st.delayHours} h`}
                </strong>{" "}
                → {st.templateName}
                {st.condition !== "none" && (
                  <span className="text-amber-700">
                    {" "}
                    ({CONDITIONS.find((c) => c.value === st.condition)?.label})
                  </span>
                )}
              </span>
              <button
                onClick={() => startTransition(() => deleteSequenceStepAction(st.id, bootcampId))}
                className="ml-auto text-red-500 hover:underline"
              >
                retirer
              </button>
            </li>
          ))}
        </ol>
      )}

      {adding && (
        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border pt-2">
          <select value={delay} onChange={(e) => setDelay(Number(e.target.value))} className={FIELD}>
            {DELAYS.map((d) => (
              <option key={d.h} value={d.h}>après {d.label}</option>
            ))}
          </select>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={FIELD}>
            <option value="">— modèle —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.subject?.trim() ? "" : " (sans objet)"}
              </option>
            ))}
          </select>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={FIELD}>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            onClick={addStep}
            disabled={isPending || !templateId}
            className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      )}

      {error && <p className="mt-1 text-[11px] text-amber-700">{error}</p>}
    </div>
  );
}
