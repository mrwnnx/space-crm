import { PageHeader } from "@/components/page-header";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Agenda" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Calendar view — Phase 8
        </p>
      </div>
    </>
  );
}
