"use server";

import { revalidatePath } from "next/cache";
import {
  resubscribeByToken,
  unsubscribeByToken,
} from "@/lib/campaigns/unsubscribe";

// Volontairement PAS de requireUser() : le destinataire d'une campagne n'a
// pas de compte. Le token tient lieu d'authentification — il est unique,
// aléatoire, et ne donne accès qu'à ce seul réglage.

export async function unsubscribeAction(token: string, campaignId?: string) {
  await unsubscribeByToken(token, campaignId || null);
  revalidatePath(`/unsubscribe/${token}`);
}

export async function resubscribeAction(token: string) {
  await resubscribeByToken(token);
  revalidatePath(`/unsubscribe/${token}`);
}
