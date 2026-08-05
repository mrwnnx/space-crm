import { getEmailTemplates, getWpConnectionPublic } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { EmailTemplatesManager } from "@/components/settings/email-templates-manager";
import { WpConnectionForm } from "@/components/settings/wp-connection-form";
import { SettingsTabs, type SettingsTab } from "@/components/settings/settings-tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const current: SettingsTab =
    tab === "emails" || tab === "providers" ? tab : "site";

  // Une seule requête, celle de l'onglet affiché (le pool DB est dimensionné
  // sur la concurrence par requête HTTP — cf. gotcha max/pooler).
  const wpConnection = current === "site" ? await getWpConnectionPublic() : null;
  const templates = current === "emails" ? await getEmailTemplates() : [];

  return (
    <>
      <PageHeader title="Settings" subtitle="Configuration du CRM" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mx-auto max-w-2xl space-y-6">
          <SettingsTabs current={current} />

          {current === "site" && (
          /* Connexion au site WordPress */
          <section>
            <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">
              Connexion site — thespace.academy
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Identifiants utilisés pour lire les soumissions de formulaire Elementor du
              site et les importer comme leads.
            </p>
            <WpConnectionForm connection={wpConnection} />
          </section>
          )}

          {current === "emails" && (
          /* Email Templates section */
          <section>
            <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">
              Email Templates
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Modèles d'emails réutilisables. Variables disponibles:{" "}
              <code className="rounded bg-muted px-1 text-[10px]">{`{{subject}}`}</code>,{" "}
              <code className="rounded bg-muted px-1 text-[10px]">{`{{content}}`}</code>
            </p>
            <EmailTemplatesManager templates={templates} />
          </section>
          )}

          {current === "providers" && (
          /* Messaging providers status */
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground font-heading">
              Providers
            </h2>
            <div className="space-y-2 text-xs">
              <ProviderRow
                name="Resend (Email)"
                configured={!!process.env.RESEND_API_KEY}
              />
              <ProviderRow
                name="Twilio (WhatsApp + SMS)"
                configured={!!process.env.TWILIO_ACCOUNT_SID}
              />
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground/60">
              Configurez les clés dans .env.local pour activer l'envoi.
            </p>
          </section>
          )}
        </div>
      </div>
    </>
  );
}

function ProviderRow({ name, configured }: { name: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{name}</span>
      <span
        className={
          configured
            ? "rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700"
            : "rounded-full bg-gray-50 px-2 py-0.5 font-medium text-gray-500"
        }
      >
        {configured ? "Configuré" : "Non configuré"}
      </span>
    </div>
  );
}
