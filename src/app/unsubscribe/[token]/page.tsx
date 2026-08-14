import { getContactByUnsubscribeToken } from "@/lib/campaigns/unsubscribe";
import { resubscribeAction, unsubscribeAction } from "./actions";

export const metadata = { title: "Désabonnement — Space Academy" };

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contact = await getContactByUnsubscribeToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Space Academy
        </p>

        {!contact ? (
          <>
            <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
              Lien invalide
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ce lien de désabonnement n&apos;est pas reconnu. Il a peut-être été
              tronqué par votre messagerie&nbsp;: essayez de le copier en entier
              dans votre navigateur.
            </p>
          </>
        ) : contact.unsubscribedAt ? (
          <>
            <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
              Vous êtes désabonné
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {contact.email} ne recevra plus nos campagnes.
            </p>
            {/* Un désabonnement par erreur de clic doit rester réparable. */}
            <form
              action={resubscribeAction.bind(null, token)}
              className="mt-6"
            >
              <button
                type="submit"
                className="text-sm font-medium text-foreground underline underline-offset-4 hover:no-underline"
              >
                C&apos;était une erreur, me réabonner
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
              Ne plus recevoir nos emails
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Confirmez pour que <strong className="text-foreground">{contact.email}</strong>{" "}
              cesse de recevoir nos campagnes. Nous pourrons toujours vous
              répondre si vous nous écrivez.
            </p>
            {/* Le désabonnement passe par un POST, jamais par le simple
                chargement de la page : les antivirus et les aperçus de lien
                des messageries visitent les URL automatiquement, ce qui
                désabonnerait des gens qui n'ont rien demandé. */}
            <form
              action={unsubscribeAction.bind(null, token)}
              className="mt-6"
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Confirmer mon désabonnement
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
