"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enregistrerCodeAction, supprimerCodeAction, type CodeSaisi } from "@/app/promo-actions";

export type CodeLigne = CodeSaisi & {
  id: string;
  leads: number;
  inscrits: number;
  encaisse: number;
};

const champ = "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground";

/**
 * Les codes promo : ce qu'ils valent (remise sur le paiement total, sur la
 * facilité), jusqu'à quand, pour quelles formations — et ce qu'ils rapportent.
 * En bas, les codes que des leads ont tapés et que rien ne reconnaît.
 */
export function CodesPromo({
  codes,
  inconnus,
  formations,
}: {
  codes: CodeLigne[];
  inconnus: { brut: string; leads: number; inscrits: number }[];
  formations: { id: string; name: string }[];
}) {
  const [edition, setEdition] = useState<CodeSaisi | null>(null);
  const vide: CodeSaisi = {
    code: "",
    label: "",
    source: "",
    remiseTotalPct: "",
    remiseFacilitePct: "",
    validFrom: "",
    validUntil: "",
    bootcampIds: [],
    assistantPeutProposer: false,
    actif: true,
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">Codes promo</h2>
          <p className="text-xs text-muted-foreground">
            Un lead peut taper « space 20 » ou « SPAEC20 » : le CRM reconnaît SPACE20. La remise
            « total » s&apos;applique au paiement en une fois ; la remise « facilité » à chaque
            mensualité — vide, le code ne vaut pas en plusieurs fois.
          </p>
        </div>
        {!edition && (
          <button
            type="button"
            onClick={() => setEdition(vide)}
            className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            + Nouveau code
          </button>
        )}
      </div>

      {edition && <Formulaire initial={edition} formations={formations} onFin={() => setEdition(null)} />}

      {codes.length === 0 && !edition ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
          Aucun code pour l&apos;instant. Les codes déjà tapés par des leads sont listés plus bas.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {codes.map((c) => (
            <LigneCode key={c.id} c={c} formations={formations} onModifier={() => setEdition(c)} />
          ))}
        </div>
      )}

      {inconnus.length > 0 && (
        <div>
          <h3 className="mb-1 text-[13px] font-semibold text-foreground">Tapés par des leads, pas reconnus</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            Créez le code : ces fiches y seront rattachées aussitôt (fautes de frappe comprises).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {inconnus.map((i) => (
              <button
                key={i.brut}
                type="button"
                onClick={() => setEdition({ ...vide, code: i.brut })}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
                title="Créer ce code"
              >
                {i.brut} <span className="text-muted-foreground">· {i.leads} lead{i.leads > 1 ? "s" : ""}{i.inscrits ? `, ${i.inscrits} inscrit${i.inscrits > 1 ? "s" : ""}` : ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function remises(c: CodeSaisi) {
  const t = c.remiseTotalPct ? `−${Number(c.remiseTotalPct)} % en une fois` : "pas en une fois";
  const f = c.remiseFacilitePct ? `−${Number(c.remiseFacilitePct)} % en facilité` : "pas en facilité";
  return `${t} · ${f}`;
}

function periode(c: CodeSaisi) {
  const d = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  if (c.validFrom && c.validUntil) return `du ${d(c.validFrom)} au ${d(c.validUntil)}`;
  if (c.validUntil) return `jusqu'au ${d(c.validUntil)}`;
  if (c.validFrom) return `à partir du ${d(c.validFrom)}`;
  return "sans date limite";
}

function LigneCode({
  c,
  formations,
  onModifier,
}: {
  c: CodeLigne;
  formations: { id: string; name: string }[];
  onModifier: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const expire = c.validUntil && c.validUntil < new Date().toISOString().slice(0, 10);
  const pour = c.bootcampIds.length
    ? c.bootcampIds.map((id) => formations.find((f) => f.id === id)?.name ?? "formation supprimée").join(", ")
    : "toutes les formations";
  return (
    <div className="flex items-start gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-foreground">{c.code}</span>
          {!c.actif && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">désactivé</span>}
          {expire && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">expiré</span>}
          {c.assistantPeutProposer && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">l&apos;assistant peut le proposer</span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {remises(c)} · {periode(c)} · {pour}
          {c.source && ` · source : ${c.source}`}
        </p>
        {c.label && <p className="mt-0.5 text-xs text-muted-foreground/80">{c.label}</p>}
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums">
        <div className="text-foreground">
          {c.leads} lead{c.leads > 1 ? "s" : ""} · {c.inscrits} inscrit{c.inscrits > 1 ? "s" : ""}
        </div>
        <div className="text-muted-foreground">
          {c.leads ? `${Math.round((c.inscrits / c.leads) * 100)} % convertis` : "—"}
          {c.encaisse > 0 && ` · ${c.encaisse.toLocaleString("fr-FR")} DT encaissés`}
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onModifier} className="text-[12.5px] text-muted-foreground hover:text-foreground hover:underline">
            Modifier
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Supprimer ${c.code} ? Les fiches gardent le texte tapé.`)) return;
              start(async () => {
                await supprimerCodeAction(c.id);
                router.refresh();
              });
            }}
            className="text-[12.5px] text-red-600 hover:underline disabled:opacity-50"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function Formulaire({
  initial,
  formations,
  onFin,
}: {
  initial: CodeSaisi;
  formations: { id: string; name: string }[];
  onFin: () => void;
}) {
  const router = useRouter();
  const [c, setC] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const maj = (p: Partial<CodeSaisi>) => setC((x) => ({ ...x, ...p }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErreur(null);
        start(async () => {
          const r = await enregistrerCodeAction(c);
          if (!r.ok) return setErreur(r.error);
          onFin();
          router.refresh();
        });
      }}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground">
          Code
          <input value={c.code} onChange={(e) => maj({ code: e.target.value.toUpperCase() })} className={`${champ} mt-1 font-mono`} placeholder="SPACE20" required />
        </label>
        <label className="text-xs text-muted-foreground">
          Source
          <input value={c.source} onChange={(e) => maj({ source: e.target.value })} className={`${champ} mt-1`} placeholder="Instagram, influenceur, partenaire…" />
        </label>
        <label className="text-xs text-muted-foreground">
          Remise paiement total (%)
          <input value={c.remiseTotalPct} onChange={(e) => maj({ remiseTotalPct: e.target.value })} inputMode="decimal" className={`${champ} mt-1`} placeholder="20" />
        </label>
        <label className="text-xs text-muted-foreground">
          Remise facilité (%)
          <input value={c.remiseFacilitePct} onChange={(e) => maj({ remiseFacilitePct: e.target.value })} inputMode="decimal" className={`${champ} mt-1`} placeholder="vide = pas valable" />
        </label>
        <label className="text-xs text-muted-foreground">
          Valable à partir du
          <input type="date" value={c.validFrom} onChange={(e) => maj({ validFrom: e.target.value })} className={`${champ} mt-1`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Jusqu&apos;au (inclus)
          <input type="date" value={c.validUntil} onChange={(e) => maj({ validUntil: e.target.value })} className={`${champ} mt-1`} />
        </label>
      </div>
      <label className="block text-xs text-muted-foreground">
        Note interne
        <input value={c.label} onChange={(e) => maj({ label: e.target.value })} className={`${champ} mt-1`} placeholder="Ex. offre rentrée, partenariat Wajahni" />
      </label>
      <div className="text-xs text-muted-foreground">
        Formations <span className="text-muted-foreground/70">(aucune cochée = toutes)</span>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {formations.map((f) => (
            <label key={f.id} className="flex items-center gap-1.5 text-foreground">
              <input
                type="checkbox"
                checked={c.bootcampIds.includes(f.id)}
                onChange={(e) =>
                  maj({ bootcampIds: e.target.checked ? [...c.bootcampIds, f.id] : c.bootcampIds.filter((x) => x !== f.id) })
                }
              />
              {f.name}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-2 text-xs text-foreground">
        <input type="checkbox" checked={c.assistantPeutProposer} onChange={(e) => maj({ assistantPeutProposer: e.target.checked })} className="mt-0.5" />
        <span>
          L&apos;assistant WhatsApp peut proposer ce code
          <span className="block text-muted-foreground">
            Une seule fois par personne, quand elle trouve le prix trop cher. Sinon il le reconnaît seulement quand on le lui donne.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" checked={c.actif} onChange={(e) => maj({ actif: e.target.checked })} />
        Actif
      </label>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFin} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted">
          Annuler
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
