import { getContactByUnsubscribeToken } from "@/lib/campaigns/unsubscribe";
import { resubscribeAction, saveReasonAction, unsubscribeAction } from "./actions";
import { UNSUBSCRIBE_REASONS } from "@/lib/campaigns/unsubscribe-reasons";

export const metadata = { title: "Désabonnement — Space Academy" };

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { token } = await params;
  const { c: campaignId } = await searchParams;
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
        ) : contact.unsubscribedAt && !contact.unsubscribeReason ? (
          <>
            {/* Désabonné : c'est FAIT, avant toute question. La raison est
                facultative — fermer la page ne change rien. */}
            <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
              C&apos;est fait
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {contact.email}{" "}ne recevra plus nos campagnes. Une dernière chose,
              si vous avez dix secondes&nbsp;: pourquoi&nbsp;?
            </p>
            <form action={saveReasonAction.bind(null, token, campaignId)} className="mt-5 space-y-2">
              {UNSUBSCRIBE_REASONS.filter((r) => r.value !== "other").map((r) => (
                <button
                  key={r.value}
                  type="submit"
                  name="reason"
                  value={r.value}
                  className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  {r.label}
                </button>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  name="note"
                  maxLength={500}
                  placeholder="Autre raison…"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="submit"
                  name="reason"
                  value="other"
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Envoyer
                </button>
              </div>
            </form>
            <form action={resubscribeAction.bind(null, token)} className="mt-6">
              <button
                type="submit"
                className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:no-underline"
              >
                C&apos;était une erreur, me réabonner
              </button>
            </form>
          </>
        ) : contact.unsubscribedAt ? (
          <>
            <h1 className="mt-2 font-heading text-xl font-semibold text-foreground">
              Merci
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
              action={unsubscribeAction.bind(null, token, campaignId)}
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
