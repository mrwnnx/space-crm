"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateTaskStatusAction, deleteTaskAction } from "@/app/actions";
import { cn, formatDate } from "@/lib/utils";
import type { Task } from "@/db/schema";

const STATUS_COLUMNS = [
  { id: "backlog", label: "Backlog", color: "bg-gray-400" },
  { id: "todo", label: "To Do", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-amber-500" },
  { id: "done", label: "Done", color: "bg-green-500" },
] as const;

const PRIORITY_CONFIG: Record<string, { label: string; classes: string }> = {
  high: { label: "High", classes: "bg-red-50 text-red-700" },
  medium: { label: "Medium", classes: "bg-amber-50 text-amber-700" },
  low: { label: "Low", classes: "bg-gray-50 text-gray-600" },
};

export function TasksBoard({ tasks }: { tasks: Task[] }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDrop(taskId: string, status: string) {
    setDragOverStatus(null);
    setDraggingId(null);
    startTransition(() => updateTaskStatusAction(taskId, status));
  }

  return (
    <div className="flex h-full overflow-x-auto p-4">
      <div className="flex h-full gap-3">
        {STATUS_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStatus(col.id);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData("text/plain");
                if (taskId) handleDrop(taskId, col.id);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg bg-muted/30 transition-colors",
                dragOverStatus === col.id && "bg-primary/5 ring-2 ring-primary/20",
                isPending && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.color)} />
                  <h2 className="text-sm font-semibold text-foreground">
                    {col.label}
                  </h2>
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggingId === task.id}
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}

                {colTasks.length === 0 && (
                  <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground/60">
                    Glisser une tâche ici
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const pr = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        <button
          onClick={() => startTransition(() => deleteTaskAction(task.id))}
          className="text-xs text-muted-foreground/50 hover:text-red-500"
        >
          ×
        </button>
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", pr.classes)}>
          {pr.label}
        </span>
        {task.dueDate && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.referenceType && task.referenceId && (
          <Link
            href={refHref(task.referenceType, task.referenceId)}
            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15"
          >
            {task.referenceType} →
          </Link>
        )}
      </div>
    </div>
  );
}

function refHref(type: string, id: string): string {
  const map: Record<string, string> = {
    lead: "leads",
    deal: "deals",
    contact: "contacts",
    organization: "organizations",
  };
  return `/${map[type] || type + "s"}/${id}`;
}
