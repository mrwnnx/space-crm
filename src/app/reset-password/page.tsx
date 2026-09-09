import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "@/app/login/actions";

/**
 * Choisir un nouveau mot de passe, depuis le lien reçu par email.
 *
 * On n'arrive ici qu'avec une session ouverte par /auth/callback. Sans elle,
 * `updateUser` n'aurait personne à modifier — d'où le renvoi vers /login
 * plutôt qu'un formulaire qui échouerait à l'envoi.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=lien_expire");

  const message =
    error === "court"
      ? "Le mot de passe doit faire au moins 8 caractères."
      : error === "different"
        ? "Les deux mots de passe ne sont pas identiques."
        : error === "1"
          ? "La modification a échoué. Redemande un lien."
          : null;

  const FIELD =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            A
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            Nouveau mot de passe
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>

        <form action={updatePassword} className="space-y-3 rounded-xl border border-border bg-card p-6">
          {message && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {message}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Nouveau mot de passe
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              className={FIELD}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">8 caractères minimum.</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Confirme-le
            </label>
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={FIELD}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Enregistrer et entrer
          </button>
        </form>
      </div>
    </div>
  );
}
