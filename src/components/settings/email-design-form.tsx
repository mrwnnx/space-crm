"use client";

import { useState, useTransition } from "react";
import { saveEmailBrandingAction, sendTestEmailAction } from "@/app/actions";
import { renderEmailTemplate, type Branding } from "@/lib/messaging/markdown";
import { ImageUploadButton } from "@/components/settings/image-upload-button";
import type { EmailBranding } from "@/db/schema";

/** Message d'exemple du volet d'aperçu — il montre tous les réglages à la fois. */
const SAMPLE = `# Titre de l'email

Bonjour Sana,

Cet email d'exemple montre à quoi ressemblent vos réglages : le **texte en gras**, un [lien](https://thespace.academy) et les deux boutons.

[[Je confirme ma place]](https://thespace.academy)

[[Voir le programme|secondaire]](https://thespace.academy)

Ceci est une note de bas de message.`;

const ALIGNS = [
  { value: "left", label: "Gauche", icon: "◧" },
  { value: "center", label: "Centre", icon: "◫" },
  { value: "right", label: "Droite", icon: "◨" },
] as const;

export function EmailDesignForm({
  branding,
  defaultSender,
  testEmail,
}: {
  branding: EmailBranding | null;
  /** EMAIL_FROM — utilisé tant qu'aucun expéditeur n'est enregistré. */
  defaultSender: string;
  testEmail: string;
}) {
  const [v, setV] = useState({
    logoUrl: branding?.logoUrl ?? "",
    logoAlt: branding?.logoAlt ?? "",
    logoWidth: String(branding?.logoWidth ?? 150),
    logoPosition: branding?.logoPosition ?? "left",
    bannerBg: branding?.bannerBg ?? "#ffffff",
    bannerImageUrl: branding?.bannerImageUrl ?? "",
    bannerTagline: branding?.bannerTagline ?? "",
    headerDivider: branding?.headerDivider ?? "#e0e2ea",
    bodyBg: branding?.bodyBg ?? "#ffffff",
    titleColor: branding?.titleColor ?? "#212327",
    textColor: branding?.textColor ?? "#5b616f",
    boldColor: branding?.boldColor ?? "#212327",
    footnoteColor: branding?.footnoteColor ?? "#a4a8b2",
    accentColor: branding?.accentColor ?? "#1a1a1a",
    primaryBtnText: branding?.primaryBtnText ?? "#ffffff",
    secondaryBtnBg: branding?.secondaryBtnBg ?? "#ffffff",
    secondaryBtnText: branding?.secondaryBtnText ?? "#3e64de",
    secondaryBtnBorder: branding?.secondaryBtnBorder ?? "#3e64de",
    buttonPosition: branding?.buttonPosition ?? "left",
    senderEmail: branding?.senderEmail ?? "",
    senderName: branding?.senderName ?? "",
    footerText: branding?.footerText ?? "",
  });
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testTo, setTestTo] = useState(testEmail);
  const [showTest, setShowTest] = useState(false);
  const [isPending, startTransition] = useTransition();

  // L'aperçu est calculé avec le MÊME moteur que l'envoi : ce qu'on voit est
  // ce qui partira.
  const preview = renderEmailTemplate(
    SAMPLE,
    {},
    { ...v, logoWidth: parseInt(v.logoWidth, 10) || 150 } as Branding
  );

  function save() {
    setResult(null);
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) fd.set(k, val);
    startTransition(async () => setResult(await saveEmailBrandingAction(fd)));
  }

  function sendTest() {
    setResult(null);
    startTransition(async () =>
      setResult(
        await sendTestEmailAction(testTo, "Aperçu du design de vos emails", SAMPLE)
      )
    );
  }

  return (
    <div>
      {/* En-tête collant : le bouton d'enregistrement reste sous la main quel
          que soit l'endroit du formulaire où l'on se trouve. */}
      <div className="sticky top-0 z-10 -mx-1 mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border bg-background px-1 pb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground font-heading">
            Design des emails
          </h2>
          <p className="text-xs text-muted-foreground">
            Un seul gabarit pour tout ce qui sort du CRM — campagnes, relances,
            envois depuis une fiche.
          </p>
        </div>
        <button
          onClick={save}
          disabled={isPending}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {result && (
        <p
          className={`mb-4 rounded-lg px-3 py-2 text-xs ${
            result.ok
              ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
          }`}
        >
          {result.message}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Formulaire ───────────────────────────────── */}
        <div className="space-y-4">
          <Card title="Logo">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 p-2">
                {v.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-muted-foreground">Aucun logo</span>
                )}
              </div>
              <div className="min-w-[180px] flex-1 space-y-2">
                <Field label="URL de l'image">
                  <Input value={v.logoUrl} onChange={set("logoUrl")} placeholder="https://…" />
                </Field>
                <ImageUploadButton label="Téléverser" onUploaded={set("logoUrl")} />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Texte alternatif">
                <Input value={v.logoAlt} onChange={set("logoAlt")} placeholder="Space Academy" />
              </Field>
              <Field label="Position">
                <AlignPicker value={v.logoPosition} onChange={set("logoPosition")} />
              </Field>
              <Field label="Largeur (px)">
                <Input value={v.logoWidth} onChange={set("logoWidth")} type="number" />
              </Field>
            </div>
            <Hint>
              ⚠️ Évitez le <strong>WebP</strong> : Outlook ne l&apos;affiche pas. L&apos;URL doit
              être publique — un client mail n&apos;a pas de session.
            </Hint>
          </Card>

          <Card title="Couleurs">
            <SubCard title="Bannière">
              <div className="grid gap-3 sm:grid-cols-2">
                <Color label="Fond de bannière" value={v.bannerBg} onChange={set("bannerBg")} />
                <Color label="Filet de séparation" value={v.headerDivider} onChange={set("headerDivider")} />
              </div>
              <div className="mt-3 space-y-2">
                <Field label="Ligne sous le logo">
                  <Input
                    value={v.bannerTagline}
                    onChange={set("bannerTagline")}
                    placeholder="Bootcamp UX · Septembre 2026"
                  />
                </Field>
                <Field label="Image de bannière (remplace le logo)">
                  <Input value={v.bannerImageUrl} onChange={set("bannerImageUrl")} placeholder="https://…" />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <ImageUploadButton label="Téléverser une bannière" onUploaded={set("bannerImageUrl")} />
                  {v.bannerImageUrl && (
                    <button
                      onClick={() => set("bannerImageUrl")("")}
                      className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            </SubCard>

            <SubCard title="Corps de l'email">
              <div className="grid gap-3 sm:grid-cols-2">
                <Color label="Fond" value={v.bodyBg} onChange={set("bodyBg")} />
                <Color label="Titres" value={v.titleColor} onChange={set("titleColor")} />
                <Color label="Texte" value={v.textColor} onChange={set("textColor")} />
                <Color label="Texte en gras" value={v.boldColor} onChange={set("boldColor")} />
                <Color label="Note de bas de message" value={v.footnoteColor} onChange={set("footnoteColor")} />
              </div>
            </SubCard>

            <SubCard title="Bouton principal">
              <div className="grid gap-3 sm:grid-cols-2">
                <Color label="Fond" value={v.accentColor} onChange={set("accentColor")} />
                <Color label="Texte" value={v.primaryBtnText} onChange={set("primaryBtnText")} />
              </div>
            </SubCard>

            <SubCard title="Bouton secondaire">
              <div className="grid gap-3 sm:grid-cols-2">
                <Color label="Fond" value={v.secondaryBtnBg} onChange={set("secondaryBtnBg")} />
                <Color label="Texte" value={v.secondaryBtnText} onChange={set("secondaryBtnText")} />
                <Color label="Contour" value={v.secondaryBtnBorder} onChange={set("secondaryBtnBorder")} />
              </div>
              <Hint>
                Écrivez <code className="rounded bg-muted px-1">[[Texte|secondaire]](url)</code>{" "}
                pour ce bouton, <code className="rounded bg-muted px-1">[[Texte]](url)</code> pour
                le principal.
              </Hint>
            </SubCard>

            <p className="mt-1 text-[11px] text-muted-foreground/70">
              Les couleurs de survol n&apos;existent pas dans un client mail : elles ne sont
              volontairement pas proposées.
            </p>
          </Card>

          <Card title="Position des boutons" inline>
            <AlignPicker value={v.buttonPosition} onChange={set("buttonPosition")} />
          </Card>

          <Card title="Expéditeur">
            <div className="space-y-3">
              <Field label="Adresse d'expédition">
                <Input
                  value={v.senderEmail}
                  onChange={set("senderEmail")}
                  placeholder={defaultSender}
                />
              </Field>
              <Field label="Nom affiché">
                <Input value={v.senderName} onChange={set("senderName")} placeholder="Space Academy" />
              </Field>
            </div>
            <Hint>
              L&apos;adresse doit finir par <strong>@send.thespace.academy</strong> — c&apos;est le
              seul domaine vérifié. Une autre ferait échouer tous les envois. Laissez vide pour
              garder <span className="font-mono">{defaultSender}</span>.
            </Hint>
          </Card>

          <Card title="Pied de page">
            <textarea
              value={v.footerText}
              onChange={(e) => set("footerText")(e.target.value)}
              rows={4}
              placeholder={"Space Academy — Tunis\nTu reçois cet email suite à ta demande."}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <Hint>
              En Markdown : les liens y sont cliquables, contrairement à du texte brut.
            </Hint>
          </Card>
        </div>

        {/* ── Aperçu ───────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    device === d
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d === "desktop" ? "Ordinateur" : "Mobile"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTest((x) => !x)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground hover:bg-muted"
            >
              Envoyer un test
            </button>
          </div>

          {showTest && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="adresse de test"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-ring"
              />
              <button
                onClick={sendTest}
                disabled={isPending || !testTo.trim()}
                className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background disabled:opacity-40"
              >
                {isPending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div
              className={`mx-auto overflow-hidden rounded-lg bg-white transition-all ${
                device === "mobile" ? "w-[390px] max-w-full" : "w-full"
              }`}
            >
              <iframe
                title="Aperçu de l'email"
                srcDoc={preview}
                sandbox=""
                className="h-[620px] w-full border-0"
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Aperçu calculé avec le moteur d&apos;envoi : ce que vous voyez est ce qui partira.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Primitives ─────────────────────────────────────── */

function Card({
  title,
  children,
  inline,
}: {
  title: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className={inline ? "flex flex-wrap items-center justify-between gap-3" : ""}>
        <h3 className={`text-sm font-semibold text-foreground ${inline ? "" : "mb-3"}`}>
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}

function SubCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 rounded-lg border border-border p-3 last:mb-0">
      <p className="mb-2.5 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
    />
  );
}

/** Pastille + hexadécimal, comme chez Tutor : on clique ou on tape. */
function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-1.5 py-1">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-6 w-7 shrink-0 cursor-pointer rounded border border-border bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none"
        />
      </div>
    </Field>
  );
}

function AlignPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {ALIGNS.map((a) => (
        <button
          key={a.value}
          type="button"
          onClick={() => onChange(a.value)}
          title={a.label}
          aria-label={a.label}
          aria-pressed={value === a.value}
          className={`rounded-md px-2.5 py-1 text-xs transition ${
            value === a.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {a.icon}
        </button>
      ))}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">{children}</p>;
}
