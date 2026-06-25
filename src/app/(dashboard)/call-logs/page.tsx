import { PageHeader } from "@/components/page-header";

export default function CallLogsPage() {
  return (
    <>
      <PageHeader title="Call Logs" subtitle="Journal d'appels" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Call logs list — Phase 7
        </p>
      </div>
    </>
  );
}
