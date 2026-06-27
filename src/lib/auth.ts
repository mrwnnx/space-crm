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
