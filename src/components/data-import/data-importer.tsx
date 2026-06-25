"use client";

import { useState, useTransition, useCallback } from "react";
import Papa from "papaparse";
import { bulkImportLeadsAction, bulkImportContactsAction } from "@/app/actions";
import { cn } from "@/lib/utils";

type EntityType = "leads" | "contacts";

const FIELD_OPTIONS: Record<EntityType, { value: string; label: string }[]> = {
  leads: [
    { value: "fullName", label: "Nom complet" },
    { value: "email", label: "Email" },
    { value: "mobileNo", label: "Mobile" },
    { value: "phone", label: "Téléphone" },
    { value: "organizationName", label: "Organisation" },
    { value: "jobTitle", label: "Job title" },
    { value: "website", label: "Website" },
  ],
  contacts: [
    { value: "fullName", label: "Nom complet" },
    { value: "email", label: "Email" },
    { value: "mobileNo", label: "Mobile" },
    { value: "phone", label: "Téléphone" },
  ],
};

export function DataImporter() {
  const [entityType, setEntityType] = useState<EntityType>("leads");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ created: number; errors: number; total: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        if (data.length === 0) return;
        const cols = Object.keys(data[0]);
        setHeaders(cols);
        setCsvData(data);

        // Auto-map: try to match column names to field names
        const autoMapping: Record<string, string> = {};
        const fieldOpts = FIELD_OPTIONS[entityType];
        for (const col of cols) {
          const normalized = col.toLowerCase().replace(/[^a-z]/g, "");
          const match = fieldOpts.find(
            (f) => f.value.toLowerCase() === normalized || f.label.toLowerCase() === col.toLowerCase()
          );
          autoMapping[col] = match?.value || "";
        }
        setMapping(autoMapping);
        setResult(null);
      },
    });
  }, [entityType]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) handleFile(file);
  }

  function handleImport() {
    startTransition(async () => {
      const action = entityType === "leads" ? bulkImportLeadsAction : bulkImportContactsAction;
      const res = await action(csvData, mapping);
      setResult(res);
      if (res.created > 0) {
        setCsvData([]);
        setHeaders([]);
        setMapping({});
      }
    });
  }

  function downloadTemplate() {
    const fields = FIELD_OPTIONS[entityType];
    const headers = fields.map((f) => f.label).join(",");
    const sample = fields.map(() => " ").join(",");
    const csv = `${headers}\n${sample}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityType}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Entity type selector */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["leads", "contacts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setEntityType(t);
              setCsvData([]);
              setHeaders([]);
              setMapping({});
              setResult(null);
            }}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-medium transition-colors",
              entityType === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "leads" ? "Leads" : "Contacts"}
          </button>
        ))}
      </div>

      {/* Upload zone */}
      {csvData.length === 0 && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border"
          )}
        >
          <p className="text-sm font-medium text-foreground">
            Glissez un fichier CSV ici
          </p>
          <p className="text-xs text-muted-foreground">ou</p>
          <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Choisir un fichier
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          <button
            onClick={downloadTemplate}
            className="text-xs text-primary hover:text-primary/80"
          >
            Télécharger un template
          </button>
        </div>
      )}

      {/* Column mapping */}
      {csvData.length > 0 && !result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {csvData.length} ligne{csvData.length > 1 ? "s" : ""} à importer
            </p>
            <button
              onClick={() => {
                setCsvData([]);
                setHeaders([]);
                setMapping({});
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>

          {/* Mapping table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Colonne CSV
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Champ {entityType === "leads" ? "Lead" : "Contact"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {headers.map((col) => (
                  <tr key={col} className="border-t border-border">
                    <td className="px-3 py-2 text-sm text-foreground">{col}</td>
                    <td className="px-3 py-2">
                      <select
                        value={mapping[col] || ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, [col]: e.target.value })
                        }
                        className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-ring"
                      >
                        <option value="">— Ignorer —</option>
                        {FIELD_OPTIONS[entityType].map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Aperçu (5 premières lignes)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {headers.map((h) => (
                        <td key={h} className="px-3 py-1.5 text-[10px] text-foreground whitespace-nowrap">
                          {row[h] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={isPending || !Object.values(mapping).some((v) => v === "fullName")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Import en cours..." : `Importer ${csvData.length} ${entityType}`}
          </button>
          {!Object.values(mapping).some((v) => v === "fullName") && (
            <p className="text-xs text-red-500">
              Vous devez mapper au moins la colonne "Nom complet"
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold text-foreground">
            Import terminé
          </p>
          <div className="mt-3 flex justify-center gap-6">
            <div>
              <p className="text-2xl font-semibold text-green-600">{result.created}</p>
              <p className="text-xs text-muted-foreground">créés</p>
            </div>
            {result.errors > 0 && (
              <div>
                <p className="text-2xl font-semibold text-red-600">{result.errors}</p>
                <p className="text-xs text-muted-foreground">erreurs</p>
              </div>
            )}
            <div>
              <p className="text-2xl font-semibold text-foreground">{result.total}</p>
              <p className="text-xs text-muted-foreground">total</p>
            </div>
          </div>
          <button
            onClick={() => setResult(null)}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Nouvel import
          </button>
        </div>
      )}
    </div>
  );
}
