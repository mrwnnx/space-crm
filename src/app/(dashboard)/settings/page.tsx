import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Configuration" />
      <div className="flex flex-1 items-center justify-center p-10">
        <p className="text-sm text-muted-foreground">
          Settings — Phase 10
        </p>
      </div>
    </>
  );
}
