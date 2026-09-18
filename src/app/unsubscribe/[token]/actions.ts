"use server";

import { revalidatePath } from "next/cache";
import {
  resubscribeByToken,
  saveUnsubscribeReason,
  unsubscribeByToken,
} from "@/lib/campaigns/unsubscribe";
import { isUnsubscribeReason } from "@/lib/campaigns/unsubscribe-reasons";

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

/**
 * La raison, après le désabonnement. Chaque bouton est un `<button name="reason">`
 * du même formulaire ; « Autre » porte en plus une ligne de texte facultative.
 * Une valeur hors liste (formulaire bricolé) est ignorée : rien n'est écrit.
 */
export async function saveReasonAction(
  token: string,
  campaignId: string | undefined,
  formData: FormData
) {
  const reason = formData.get("reason");
  if (!isUnsubscribeReason(reason)) return;
  const note = reason === "other" ? String(formData.get("note") ?? "").trim().slice(0, 500) : "";
  await saveUnsubscribeReason(token, reason, note || null, campaignId || null);
  revalidatePath(`/unsubscribe/${token}`);
}
