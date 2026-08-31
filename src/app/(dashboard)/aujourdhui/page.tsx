import { getCallQueue } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { CallQueue } from "@/components/leads/call-queue";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const queue = await getCallQueue(40);

  return (
    <>
      <PageHeader
        title="Aujourd'hui"
        subtitle="Qui rappeler, et dans quel ordre"
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-xs text-muted-foreground">
            Classement calculé : intention lue par l&apos;IA, ancienneté dans la
            colonne, formule choisie, et surtout <strong>qui a déjà été appelé</strong>.
            Chaque ligne affiche les raisons de sa place.
          </p>
          <CallQueue leads={queue} />
        </div>
      </div>
    </>
  );
}
