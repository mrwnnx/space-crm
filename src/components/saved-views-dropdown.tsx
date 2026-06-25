"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { saveViewAction, deleteViewAction } from "@/app/actions";
import { cn } from "@/lib/utils";

type SavedView = {
  id: string;
  label: string;
  type: string;
  filters: { q?: string } | null;
  public: boolean;
};

export function SavedViewsDropdown({
  routeName,
  views,
  currentView,
  currentSearch,
}: {
  routeName: string;
  views: SavedView[];
  currentView: string;
  currentSearch: string;
}) {
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [label, setLabel] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [isPending, startTransition] = useTransition();

  function viewHref(view: SavedView): string {
    const params = new URLSearchParams();
    if (view.type === "kanban") params.set("view", "kanban");
    if (view.filters?.q) params.set("q", view.filters.q);
    const qs = params.toString();
    return qs ? `/${routeName}?${qs}` : `/${routeName}`;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    startTransition(async () => {
      await saveViewAction(routeName, label, currentView, currentSearch, isPublic);
      setLabel("");
      setShowSave(false);
      setOpen(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(() => deleteViewAction(id, routeName));
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        Views
        <span className="text-[10px]">▾</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => { setOpen(false); setShowSave(false); }}
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card py-1 shadow-lg">
            {/* Default view */}
            <Link
              href={`/${routeName}`}
              className={cn(
                "flex items-center justify-between px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted",
                currentView === "list" && !currentSearch && "bg-muted/50 font-medium"
              )}
              onClick={() => setOpen(false)}
            >
              All {routeName}
            </Link>

            {/* Saved views */}
            {views.map((view) => (
              <div
                key={view.id}
                className="group flex items-center justify-between px-3 py-1.5 transition-colors hover:bg-muted"
              >
                <Link
                  href={viewHref(view)}
                  className="flex-1 text-xs text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {view.label}
                  {view.public && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/60">
                      public
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => handleDelete(view.id)}
                  className="ml-2 text-muted-foreground/40 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <HugeiconsIcon icon={Delete02Icon} size={12} />
                </button>
              </div>
            ))}

          {/* Divider + Save */}
          <div className="my-1 h-px bg-border" />
          <button
            onClick={() => setShowSave(!showSave)}
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <HugeiconsIcon icon={Add01Icon} size={12} />
            Save current view
          </button>

          {/* Save form */}
          {showSave && (
            <form
              onSubmit={handleSave}
              className="border-t border-border px-3 py-2.5 space-y-2"
            >
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="View name..."
                required
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
              />
              <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-3 w-3"
                />
                Public
              </label>
              <button
                type="submit"
                disabled={isPending || !label.trim()}
                className="w-full rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {isPending ? "..." : "Sauvegarder"}
              </button>
            </form>
          )}
          </div>
        </>
      )}
    </div>
  );
}
