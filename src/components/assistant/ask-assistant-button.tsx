"use client";

/**
 * Ouvre l'assistant avec une question déjà posée.
 *
 * Passe par un événement de fenêtre plutôt que par un état partagé : le
 * panneau vit dans la mise en page, le bouton dans une fiche, et les faire
 * communiquer autrement demanderait un contexte React traversant tout le CRM
 * pour un seul usage.
 */
export function AskAssistantButton({
  question,
  label,
  className,
}: {
  question: string;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("assistant:ask", { detail: question }))}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      }
    >
      <span className="text-primary">✦</span>
      {label}
    </button>
  );
}
