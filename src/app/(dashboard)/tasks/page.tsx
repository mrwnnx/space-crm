import { PageHeader } from "@/components/page-header";

export default function TasksPage() {
  return (
    <>
      <PageHeader title="Tasks" subtitle="Vos tâches" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Tasks board — Phase 4
        </p>
      </div>
    </>
  );
}
