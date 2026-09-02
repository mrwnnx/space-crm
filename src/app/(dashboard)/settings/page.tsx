import { getAllowedEmails, getEmailTemplates, getWpConnectionPublic, getEmailBranding } from "@/lib/queries";
import { currentActor } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { EmailTemplatesManager } from "@/components/settings/email-templates-manager";
import { WpConnectionForm } from "@/components/settings/wp-connection-form";
import { TeamManager } from "@/components/settings/team-manager";
import { EmailDesignForm } from "@/components/settings/email-design-form";
import { SettingsTabs, type SettingsTab } from "@/components/settings/settings-tabs";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const current: SettingsTab =
    tab === "emails" || tab === "providers" || tab === "team" || tab === "branding"
      ? tab
      : "site";

  // Une seule requête, celle de l'onglet affiché (le pool DB est dimensionné
  // sur la concurrence par requête HTTP — cf. gotcha max/pooler).
  const wpConnection = current === "site" ? await getWpConnectionPublic() : null;
  // L'aperçu d'un modèle doit montrer l'email TEL QU'IL PARTIRA, habillage
  // compris — sinon on valide une mise en page qu'on ne verra jamais.
  const templates = current === "emails" ? await getEmailTemplates() : [];
  const templateBranding = current === "emails" ? await getEmailBranding() : null;
  // Adresse du compte connecté : pré-remplit le champ « envoyer un test ».
  const testEmail =
    current === "emails" || current === "branding" ? ((await currentActor()) ?? "") : "";
  const allowed = current === "team" ? await getAllowedEmails() : [];
  const branding = current === "branding" ? await getEmailBranding() : null;

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
            <EmailTemplatesManager
              templates={templates}
              branding={templateBranding}
              testEmail={testEmail}
            />
          </section>
          )}

          {current === "branding" && (
          /* Enveloppe commune à tous les emails */
          <section>
            <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">
              Habillage des emails
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              En-tête et pied de page appliqués à <strong>tous</strong> les envois :
              automatisations et emails écrits depuis une fiche lead. Les modèles ne
              contiennent que le message.
            </p>
            <EmailDesignForm
              branding={branding}
              defaultSender={process.env.EMAIL_FROM ?? "Expéditeur non configuré"}
              testEmail={testEmail}
            />
          </section>
          )}

          {current === "team" && (
          /* Collaborateurs autorisés à créer un compte */
          <section>
            <h2 className="mb-1 text-sm font-semibold text-foreground font-heading">
              Équipe
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Seuls les emails de cette liste peuvent créer un compte sur le CRM.
              Retirer un email empêche une future inscription mais ne supprime pas
              un compte déjà créé (ça se fait dans le dashboard Supabase).
            </p>
            <TeamManager emails={allowed} />
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
