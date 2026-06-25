import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Vue d'ensemble" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Widgets dashboard — Phase 8
        </p>
      </div>
    </>
  );
}
