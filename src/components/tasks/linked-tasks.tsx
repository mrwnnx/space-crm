"use client";

import { useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { createTaskAction, updateTaskStatusAction } from "@/app/actions";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/db/schema";

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-gray-400",
};

export function LinkedTasks({
  tasks,
  referenceType,
  referenceId,
}: {
  tasks: Task[];
  referenceType: "lead" | "deal" | "contact" | "organization";
  referenceId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function quickAdd(formData: FormData) {
    formData.set("referenceType", referenceType);
    formData.set("referenceId", referenceId);
    startTransition(async () => {
      await createTaskAction(formData);
    });
  }

  return (
    <div className="border-t border-border p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tasks ({tasks.length})
        </p>
      </div>

      <div className="space-y-1.5">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 rounded-md p-1.5 transition-colors hover:bg-muted/40"
          >
            <button
              onClick={() =>
                startTransition(() =>
                  updateTaskStatusAction(
                    task.id,
                    task.status === "done" ? "todo" : "done"
                  )
                )
              }
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                task.status === "done"
                  ? "border-green-500 bg-green-500 text-white"
                  : "border-border bg-background text-transparent hover:border-primary"
              )}
            >
              ✓
            </button>
            <span
              className={cn(
                "flex-1 truncate text-xs",
                task.status === "done"
                  ? "text-muted-foreground line-through"
                  : "text-foreground"
              )}
            >
              {task.title}
            </span>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium
              )}
            />
            {task.dueDate && (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDate(task.dueDate)}
              </span>
            )}
          </div>
        ))}

        {tasks.length === 0 && (
          <p className="py-2 text-center text-[10px] text-muted-foreground/60">
            Aucune tâche
          </p>
        )}
      </div>

      {/* Quick add */}
      <form action={quickAdd} className="mt-2 flex items-center gap-1.5">
        <input
          name="title"
          required
          placeholder="Ajouter une tâche..."
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
        />
        <input type="hidden" name="priority" value="medium" />
        <button
          type="submit"
          disabled={isPending}
          className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          <HugeiconsIcon icon={Add01Icon} size={12} />
        </button>
      </form>
    </div>
  );
}
