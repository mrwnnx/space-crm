import { PageHeader } from "@/components/page-header";

export default function NotesPage() {
  return (
    <>
      <PageHeader title="Notes" subtitle="Vos notes" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Notes list — Phase 4
        </p>
      </div>
    </>
  );
}
