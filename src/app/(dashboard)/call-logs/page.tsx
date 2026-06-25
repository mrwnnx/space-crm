import { getCallLogs } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { cn, formatDate, formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  completed: { label: "Completed", classes: "bg-green-50 text-green-700" },
  failed: { label: "Failed", classes: "bg-red-50 text-red-700" },
  busy: { label: "Busy", classes: "bg-amber-50 text-amber-700" },
  no_answer: { label: "No Answer", classes: "bg-gray-50 text-gray-600" },
  canceled: { label: "Canceled", classes: "bg-gray-50 text-gray-600" },
  initiated: { label: "Initiated", classes: "bg-blue-50 text-blue-700" },
};

const TYPE_LABELS: Record<string, string> = {
  incoming: "Entrant",
  outgoing: "Sortant",
};

export default async function CallLogsPage() {
  const logs = await getCallLogs();

  return (
    <>
      <PageHeader
        title="Call Logs"
        subtitle={`${logs.length} appel${logs.length > 1 ? "s" : ""}`}
      />
      <div className="flex-1 overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-10">
            <p className="text-sm font-medium text-foreground">Aucun appel</p>
            <p className="text-xs text-muted-foreground">
              Les appels loggés depuis les leads/deals apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border">
                  <th className="px-3 py-2.5 pl-5 text-left text-xs font-medium text-muted-foreground">Type</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">From</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">To</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Durée</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">Médium</th>
                  <th className="px-3 py-2.5 pr-5 text-right text-xs font-medium text-muted-foreground">Quand</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const sc = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.initiated;
                  return (
                    <tr key={log.id} className="border-b border-border transition-colors hover:bg-muted/40">
                      <td className="py-2.5 pl-5">
                        <span className="text-sm font-medium text-foreground">
                          {TYPE_LABELS[log.type] ?? log.type}
                        </span>
                      </td>
                      <td>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", sc.classes)}>
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground">
                          {log.fromNumber || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground">
                          {log.toNumber || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground">
                          {log.duration ? `${log.duration}s` : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground capitalize">
                          {log.telephonyMedium}
                        </span>
                      </td>
                      <td className="pr-5 text-right">
                        <span className="text-xs text-muted-foreground">
                          {formatRelative(log.createdAt)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
