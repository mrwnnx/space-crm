import Link from "next/link";
import { getNotes } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { NewNoteButton } from "@/components/notes/new-note-button";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notesList = await getNotes();

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={`${notesList.length} note${notesList.length > 1 ? "s" : ""}`}
        actions={<NewNoteButton />}
      />
      <div className="flex-1 overflow-y-auto p-5">
        {notesList.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-sm font-medium text-foreground">Aucune note</p>
            <p className="text-xs text-muted-foreground">
              Créez votre première note pour commencer.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notesList.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                {note.title && (
                  <h3 className="mb-1.5 text-sm font-semibold text-foreground">
                    {note.title}
                  </h3>
                )}
                <p className="line-clamp-4 text-sm text-muted-foreground whitespace-pre-wrap">
                  {note.content}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-2">
                  {note.referenceType && note.referenceId ? (
                    <Link
                      href={refHref(note.referenceType, note.referenceId)}
                      className="text-xs font-medium text-primary hover:text-primary/80"
                    >
                      {note.referenceType} →
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">
                      Note libre
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground/60">
                    {formatRelative(note.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
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
