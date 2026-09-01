import {
  getOpenBootcamps,
  getSequencesByBootcamp,
  getLeadStatuses,
  getTags,
  getEmailTemplates,
} from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { SequencesManager } from "@/components/bootcamps/sequences-manager";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  // Formations en cours seulement : automatiser une session terminée n'a pas
  // de sens, et ça encombrerait l'écran.
  const bootcamps = await getOpenBootcamps();
  const tags = await getTags();
  const templates = await getEmailTemplates();

  const blocks = [];
  for (const b of bootcamps) {
    blocks.push({
      bootcamp: b,
      sequences: await getSequencesByBootcamp(b.id),
      stages: await getLeadStatuses(b.id),
    });
  }

  return (
    <>
      <PageHeader
        title="Automatisations"
        subtitle="Les emails qui partent tout seuls"
      />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-3xl space-y-6">
          <p className="text-xs text-muted-foreground">
            Une <strong>campagne</strong> part une fois, à une liste. Une{" "}
            <strong>séquence</strong> suit une personne dans le temps : elle démarre
            sur un déclencheur, enchaîne des étapes espacées, et{" "}
            <strong>s&apos;arrête d&apos;elle-même</strong>{" "}
            dès que la personne s&apos;inscrit, se désabonne ou est écartée au
            téléphone.
          </p>

          {blocks.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Aucune formation en cours.
            </p>
          )}

          {blocks.map(({ bootcamp, sequences, stages }) => (
            <section key={bootcamp.id}>
              <h2 className="mb-2 text-sm font-semibold text-foreground font-heading">
                {bootcamp.name}
              </h2>
              <SequencesManager
                bootcampId={bootcamp.id}
                sequences={sequences}
                stages={stages.map((s) => ({ id: s.id, name: s.name }))}
                tags={tags.map((t) => ({ id: t.id, name: t.name }))}
                templates={templates.map((t) => ({
                  id: t.id,
                  name: t.name,
                  subject: t.subject,
                }))}
              />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
