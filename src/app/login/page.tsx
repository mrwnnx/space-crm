import Link from "next/link";
import { login, signup, requestPasswordReset } from "./actions";

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string; sent?: string }>;
}) {
  const { error, mode, sent } = await searchParams;
  return <LoginContent error={error} mode={mode} sent={sent} />;
}

function LoginContent({
  error,
  mode,
  sent,
}: {
  error?: string;
  mode?: string;
  sent?: string;
}) {
  const errorMessage =
    error === "unauthorized"
      ? "Inscription non autorisée pour cet email. Contacte l'administrateur."
      : error === "lien_expire"
        ? "Ce lien a déjà servi ou a expiré. Demande-en un nouveau."
        : error === "lien_invalide"
          ? "Ce lien est incomplet. Demande-en un nouveau."
          : error === "email_manquant"
            ? "Saisis ton adresse email."
            : error === "1"
              ? "Email ou mot de passe incorrect."
              : null;

  const forgot = mode === "forgot";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">Academy CRM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {forgot ? "Réinitialiser ton mot de passe" : "Connectez-vous pour continuer"}
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {forgot ? (
            sent ? (
              <>
                <p className="text-sm font-medium text-foreground">Regarde ta boîte mail.</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Si un compte existe avec cette adresse, un lien de réinitialisation vient
                  d&apos;y être envoyé. Il ne sert qu&apos;une fois. Pense à regarder dans les
                  spams.
                </p>
                <Link
                  href="/login"
                  className="inline-block text-xs text-muted-foreground underline hover:text-foreground"
                >
                  ← Revenir à la connexion
                </Link>
              </>
            ) : (
              <form action={requestPasswordReset} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Ton adresse email
                  </label>
                  <input name="email" type="email" required autoFocus className={FIELD} />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Recevoir un lien de réinitialisation
                </button>
                <Link
                  href="/login"
                  className="block text-center text-xs text-muted-foreground underline hover:text-foreground"
                >
                  ← Revenir à la connexion
                </Link>
              </form>
            )
          ) : (
            <>
              <form className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Email
                  </label>
                  <input name="email" type="email" required className={FIELD} />
                </div>
                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Mot de passe
                    </label>
                    {/* Le seul recours pour qui a oublié : sans ce lien, il
                        fallait passer par le tableau de bord Supabase. */}
                    <Link
                      href="/login?mode=forgot"
                      className="text-[11px] text-muted-foreground underline hover:text-foreground"
                    >
                      Oublié ?
                    </Link>
                  </div>
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className={FIELD}
                  />
                </div>
                <button
                  formAction={login}
                  type="submit"
                  className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Se connecter
                </button>
              </form>

              <div className="relative">
                <div className="h-px bg-border" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  ou
                </span>
              </div>

              <form className="space-y-3">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email"
                  className={FIELD}
                />
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mot de passe (8 caractères minimum)"
                  autoComplete="new-password"
                  className={FIELD}
                />
                <button
                  formAction={signup}
                  type="submit"
                  className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Créer un compte
                </button>
                <p className="text-[11px] text-muted-foreground">
                  Réservé aux adresses invitées par l&apos;administrateur.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
