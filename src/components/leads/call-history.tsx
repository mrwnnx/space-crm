import { actorInitials, actorLabel, isHumanActor } from "@/lib/utils";

/** Ce que le résultat de l'appel dit, en clair. `logCallOutcomeAction` écrit
 *  les trois premiers ; les autres valeurs de l'enum viennent de la téléphonie
 *  (Twilio) et ne sont pas produites par la saisie manuelle. */
const OUTCOME: Record<string, { label: string; dot: string; text: string }> = {
  completed: { label: "Joint", dot: "bg-green-500", text: "text-green-700" },
  no_answer: { label: "Pas répondu", dot: "bg-amber-500", text: "text-amber-700" },
  failed: { label: "Faux numéro", dot: "bg-red-500", text: "text-red-700" },
  busy: { label: "Occupé", dot: "bg-amber-500", text: "text-amber-700" },
  canceled: { label: "Annulé", dot: "bg-gray-400", text: "text-muted-foreground" },
};

export type CallHistoryEntry = {
  id: string;
  status: string;
  duration: number | null;
  callerId: string | null;
  createdAt: Date;
};

/** L'historique des tentatives : combien de fois cette personne a été appelée,
 *  quand exactement, et ce que ça a donné. La timeline mélange les appels aux
 *  emails et aux notes, et n'affiche qu'un relatif (« Aujourd'hui ») — inutile
 *  pour distinguer deux rappels le même jour. */
export function CallHistory({ logs }: { logs: CallHistoryEntry[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="border-t border-border p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Appels ({logs.length})
      </p>

      <div className="space-y-2">
        {logs.map((log) => {
          const outcome = OUTCOME[log.status] ?? {
            label: log.status,
            dot: "bg-gray-400",
            text: "text-muted-foreground",
          };
          const minutes = log.duration ? Math.round(log.duration / 60) : 0;
          return (
            <div key={log.id}>
              <div className="flex items-baseline gap-1.5 text-xs">
                <span
                  className={`h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full ${outcome.dot}`}
                />
                <span className={`font-medium ${outcome.text}`}>{outcome.label}</span>
                {minutes > 0 && (
                  <span className="text-muted-foreground">· {minutes} min</span>
                )}
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  {/* Fuseau explicite : le rendu se fait sur le serveur (UTC en
                      prod) — sans ça une heure du soir bascule la veille. */}
                  {log.createdAt.toLocaleString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Africa/Tunis",
                  })}
                </span>
              </div>
              {isHumanActor(log.callerId) && (
                <p className="ml-3 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 text-[7px] font-semibold text-primary">
                    {actorInitials(log.callerId)}
                  </span>
                  par {actorLabel(log.callerId)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
