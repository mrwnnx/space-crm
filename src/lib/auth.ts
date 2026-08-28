import "server-only";
import { createClient } from "@/lib/supabase/server";

// Garde d'authentification pour les server actions.
// Le proxy.ts garde les routes HTTP, mais les server actions s'exécutent dans le
// même processus et ne revérifient pas la session par défaut. requireUser() comble
// ce gap pour les actions destructives et de masse (Phase 2).
//
// Usage : `await requireUser()` en tête de l'action, avant toute mutation.
// Si pas de session → throw (interrompt l'action, ne mute rien).
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Non authentifié");
  }
  return user;
}

/**
 * Email du compte qui exécute l'action, ou `null` hors session (cron Vercel,
 * GitHub Actions, webhook entrant). Sert à attribuer les événements du fil
 * d'activité : on stocke l'email parce que la colonne `created_by` est déjà
 * un `text` et qu'il est lisible tel quel — un id Supabase imposerait un
 * aller-retour vers l'API admin à chaque affichage.
 *
 * Ne jette JAMAIS : un contexte sans requête HTTP (cron) fait échouer
 * `cookies()`, et ce n'est pas une raison pour faire échouer l'écriture.
 */
export async function currentActor(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}
