"use client";

import { useState, useTransition } from "react";
import { saveEmailBrandingAction } from "@/app/actions";
import { renderEmailTemplate } from "@/lib/messaging/markdown";
import type { EmailBranding } from "@/db/schema";
import { ImageUploadButton } from "@/components/settings/image-upload-button";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

// Message d'exemple : montre l'en-tête, un bouton et le pied de page d'un coup.
const DEMO = `Bonjour Sana,

Voici à quoi ressemblent tes emails.

[[Je confirme ma place]](https://thespace.academy)`;

export function EmailBrandingForm({ branding }: { branding: EmailBranding | null }) {
  const [logoUrl, setLogoUrl] = useState(branding?.logoUrl ?? "");
  const [logoWidth, setLogoWidth] = useState(String(branding?.logoWidth ?? 150));
  const [footerText, setFooterText] = useState(branding?.footerText ?? "");
  const [accentColor, setAccentColor] = useState(branding?.accentColor ?? "#1a1a1a");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("logoUrl", logoUrl);
    fd.set("logoWidth", logoWidth);
    fd.set("footerText", footerText);
    fd.set("accentColor", accentColor);
    startTransition(async () => setResult(await saveEmailBrandingAction(fd)));
  }

  const preview = renderEmailTemplate(
    DEMO,
    {},
    {
      logoUrl: logoUrl || null,
      logoWidth: parseInt(logoWidth, 10) || 150,
      footerText: footerText || null,
      accentColor: /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#1a1a1a",
    }
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form onSubmit={save} className="space-y-3">
        <div>
          <label className={LABEL}>URL du logo (https, PNG ou JPG)</label>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://thespace.academy/wp-content/uploads/logo.png"
            className={FIELD}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ImageUploadButton label="Téléverser un logo" onUploaded={setLogoUrl} />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground/70">
            ⚠️ Évite le <strong>WebP</strong> : Outlook ne l&apos;affiche pas. L&apos;URL doit
            être publique — un client mail n&apos;a pas de session.
          </p>
        </div>
        <div>
          <label className={LABEL}>Largeur du logo (px)</label>
          <input
            value={logoWidth}
            onChange={(e) => setLogoWidth(e.target.value)}
            type="number"
            min={40}
            max={560}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Couleur des boutons</label>
          <div className="flex items-center gap-2">
            <input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              type="color"
              className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
            />
            <input
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <div>
          <label className={LABEL}>Pied de page (commun à tous les emails)</label>
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={3}
            placeholder="The Space Academy — Tunis&#10;Tu reçois cet email suite à ta demande sur thespace.academy"
            className={`resize-none ${FIELD}`}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Enregistrement..." : "Enregistrer l'habillage"}
        </button>
        {result && (
          <p
            className={
              result.ok
                ? "text-xs text-green-600"
                : "rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800"
            }
          >
            {result.message}
          </p>
        )}
      </form>

      <div className="rounded-lg border border-border bg-white p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          Aperçu d&apos;un email complet
        </p>
        <div dangerouslySetInnerHTML={{ __html: preview }} />
      </div>
    </div>
  );
}
