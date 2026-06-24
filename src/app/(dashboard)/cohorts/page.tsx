import { getCohorts } from "@/lib/queries";
import { CohortList } from "@/components/cohorts/cohort-list";
import { CreateCohortForm } from "@/components/cohorts/create-cohort-form";

export const dynamic = "force-dynamic";

export default async function CohortsPage() {
  const cohorts = await getCohorts();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Cohorts</h1>
          <p className="text-xs text-slate-500">
            {cohorts.length} cohort(s)
          </p>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CohortList cohorts={cohorts} />
        </div>
        <div>
          <CreateCohortForm />
        </div>
      </div>
    </div>
  );
}
