"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import { bulkImportLeadsAction, bulkImportContactsAction, type BulkImportResult } from "@/app/actions";
import { cn } from "@/lib/utils";

type EntityType = "leads" | "contacts";
type Option = { id: string; name: string };

// Lignes envoyées par appel serveur : petit pour que la progression avance par pas visibles et tienne dans la fenêtre Vercel.
const CHUNK_SIZE = 50;
// Il faut de quoi nommer la personne : un nom complet, un prénom/nom, ou à défaut un email.
const NAME_FIELDS = ["fullName", "firstName", "lastName", "email"];

const FIELD_OPTIONS: Record<EntityType, { value: string; label: string }[]> = {
  leads: [
    { value: "fullName", label: "Nom complet" },
    { value: "firstName", label: "Prénom" },
    { value: "lastName", label: "Nom" },
    { value: "email", label: "Email" },
    { value: "mobileNo", label: "Mobile" },
    { value: "phone", label: "Téléphone" },
    { value: "organizationName", label: "Organisation" },
    { value: "jobTitle", label: "Job title" },
    { value: "website", label: "Website" },
  ],
  contacts: [
    { value: "fullName", label: "Nom complet" },
    { value: "firstName", label: "Prénom" },
    { value: "lastName", label: "Nom" },
    { value: "email", label: "Email" },
    { value: "mobileNo", label: "Mobile" },
    { value: "phone", label: "Téléphone" },
  ],
};

export function DataImporter({ tags, bootcamps }: { tags: Option[]; bootcamps: Option[] }) {
  const [entityType, setEntityType] = useState<EntityType>("leads");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [tagId, setTagId] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [bootcampId, setBootcampId] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Avancement en direct : lignes traitées et compteurs cumulés, mis à jour à chaque paquet.
  const [progress, setProgress] = useState<BulkImportResult>({ created: 0, existing: 0, skipped: 0, errors: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  const canImport = Object.values(mapping).some((v) => NAME_FIELDS.includes(v));

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

  async function handleImport() {
    setIsPending(true);
    const total: BulkImportResult = { created: 0, existing: 0, skipped: 0, errors: 0, total: 0 };
    setProgress({ ...total });
    try {
      for (let i = 0; i < csvData.length; i += CHUNK_SIZE) {
        const chunk = csvData.slice(i, i + CHUNK_SIZE);
        const res =
          entityType === "leads"
            ? await bulkImportLeadsAction(chunk, mapping, {
                tagId: tagId || null,
                newTagName: newTagName || null,
                bootcampId: bootcampId || null,
              })
            : await bulkImportContactsAction(chunk, mapping);
        for (const k of ["created", "existing", "skipped", "errors", "total"] as const) total[k] += res[k];
        if (res.firstError && !total.firstError) total.firstError = res.firstError;
        setProgress({ ...total });
      }
    } catch (e) {
      // Un paquet a échoué (réseau, délai) : on compte ses lignes en erreur et on montre ce qui a été fait.
      total.errors += csvData.length - total.total;
      total.total = csvData.length;
      if (!total.firstError) total.firstError = e instanceof Error ? e.message : String(e);
    }
    setResult(total);
    setIsPending(false);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
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

          {/* Tag + destination (leads seulement) */}
          {entityType === "leads" && (
            <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Tag à poser sur chaque lead</span>
                <select
                  value={tagId}
                  onChange={(e) => {
                    setTagId(e.target.value);
                    if (e.target.value) setNewTagName("");
                  }}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
                >
                  <option value="">— Aucun —</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newTagName}
                  onChange={(e) => {
                    setNewTagName(e.target.value);
                    if (e.target.value) setTagId("");
                  }}
                  placeholder="ou un nouveau tag…"
                  maxLength={40}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Formation de destination</span>
                <select
                  value={bootcampId}
                  onChange={(e) => setBootcampId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
                >
                  <option value="">Aucune — base de contacts, hors kanban</option>
                  {bootcamps.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Un email déjà connu ne crée pas de doublon : le tag est posé sur le lead existant.
                </p>
              </label>
            </div>
          )}

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

          {isPending ? (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-foreground">Import en cours…</p>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {Math.round((progress.total / csvData.length) * 100)} %
                </p>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${(progress.total / csvData.length) * 100}%` }}
                />
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {progress.total} / {csvData.length} lignes · {progress.created} créés · {progress.existing} déjà présents
                {progress.skipped > 0 && ` · ${progress.skipped} ignorés`}
                {progress.errors > 0 && ` · ${progress.errors} erreurs`}
              </p>
            </div>
          ) : (
            <button
              onClick={handleImport}
              disabled={!canImport}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {`Importer ${csvData.length} ${entityType}`}
            </button>
          )}
          {!canImport && (
            <p className="text-xs text-red-500">
              Mappez au moins une colonne Nom complet, Prénom / Nom, ou Email
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
          <div className="mt-3 flex flex-wrap justify-center gap-6">
            <div>
              <p className="text-2xl font-semibold text-green-600">{result.created}</p>
              <p className="text-xs text-muted-foreground">créés</p>
            </div>
            {result.existing > 0 && (
              <div>
                <p className="text-2xl font-semibold text-foreground">{result.existing}</p>
                <p className="text-xs text-muted-foreground">déjà présents</p>
              </div>
            )}
            {result.skipped > 0 && (
              <div>
                <p className="text-2xl font-semibold text-muted-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">ignorés (sans nom ni email)</p>
              </div>
            )}
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
          {result.firstError && (
            <p className="mt-3 break-words rounded-md bg-red-50 px-3 py-2 text-left text-xs text-red-700">
              Première erreur : {result.firstError}
            </p>
          )}
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
