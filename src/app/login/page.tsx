import Link from "next/link";
import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginContent error={error} />;
}

function LoginContent({ error }: { error?: string }) {
  const errorMessage =
    error === "unauthorized"
      ? "Inscription non autorisée pour cet email. Contacte l'administrateur."
      : error === "1"
        ? "Email ou mot de passe incorrect."
        : null;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <h1 className="text-xl font-semibold text-foreground font-heading">
            Academy CRM
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez-vous pour continuer
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          {errorMessage && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          <form className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Mot de passe
              </label>
              <input
                name="password"
                type="password"
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
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
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <input
              name="password"
              type="password"
              required
              placeholder="Mot de passe"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              formAction={signup}
              type="submit"
              className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Créer un compte
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/leads" className="hover:text-foreground">
            ← Retour
          </Link>
        </p>
      </div>
    </div>
  );
}
