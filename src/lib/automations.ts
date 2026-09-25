import "server-only";
import { db } from "@/db";
import { activities, automations, automationRuns, contacts, leads } from "@/db/schema";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { DAILY_LIMIT, sentToday } from "@/lib/messaging/quota";
import { echeanceTunis } from "@/lib/automation-delays";

type RunStatus = "pending" | "sent" | "skipped" | "failed" | "cancelled";

/** Le lendemain à 00 h 05 : la file repart quand le plafond Resend est remis à zéro. */
function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 5, 0, 0);
  return d;
}

/**
 * A-t-on DÉJÀ envoyé (ou programmé) cet email à ce lead ?
 *
 * Décision de Marwen : un lead ne reçoit jamais deux fois le même email, quel
 * que soit le chemin d'entrée. Un run `cancelled` ou `skipped` ne bloque rien —
 * cet email-là n'est jamais parti. Doublé d'un index unique en base (0120) :
 * ce contrôle évite la collision, l'index la rend impossible.
 */
async function alreadyHandled(automationId: string, leadId: string): Promise<boolean> {
  const existing = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.automationId, automationId),
      eq(automationRuns.leadId, leadId),
      inArray(automationRuns.status, ["sent", "pending"])
    ),
    columns: { id: true },
  });
  return !!existing;
}

/**
 * Déclencheur « le lead entre dans cette colonne ».
 *
 * Appelé depuis les TROIS chemins d'entrée (glisser-déposer, popup
 * d'inscription, import du site) : une règle qui ne marcherait que depuis le
 * kanban resterait muette sur les ~50 leads/semaine venus du formulaire.
 *
 * Délai 0 → envoi immédiat. Délai > 0 → mise en file d'attente, vidée par
 * /api/cron/automations.
 *
 * ⚠️ Ne jette JAMAIS : un email refusé ne doit faire échouer ni le déplacement
 * du lead ni l'import.
 */
export async function runStatusAutomations(
  leadId: string,
  statusId: string | null | undefined
): Promise<void> {
  if (!statusId) return;

  // Le tag d'abord, et HORS du try/catch de l'email : il ne dépend d'aucune
  // règle d'envoi, et il doit être posé même si aucun email n'est configuré
  // sur cette colonne — sinon le `return` ci-dessous l'empêcherait.
  const { applyStageTag } = await import("@/lib/stage-tags");
  await applyStageTag(leadId, statusId);

  try {
    // Une colonne peut porter plusieurs règles (séquence, 0142) : chacune est
    // posée à son moment, indépendamment des autres.
    const rules = await db.query.automations.findMany({
      where: and(eq(automations.statusId, statusId), eq(automations.active, true)),
      orderBy: [asc(automations.createdAt)],
    });
    const entree = new Date();
    // Un numéro de test reçoit à CHAQUE entrée dans la colonne : on glisse la
    // fiche d'avant en arrière pour vérifier une règle. Un vrai lead, une fois.
    const { estNumeroDeTest } = await import("@/lib/messaging/whatsapp");
    const fiche = await db.query.leads.findFirst({ where: eq(leads.id, leadId), columns: { mobileNo: true } });
    const test = estNumeroDeTest(fiche?.mobileNo);
    for (const rule of rules) {
      try {
        if (!test && (await alreadyHandled(rule.id, leadId))) continue;

        const echeance = echeanceDeRegle(rule, entree);
        if (echeance) {
          // Rien n'est envoyé maintenant : on pose l'échéance, le cron s'en charge.
          await db.insert(automationRuns).values({
            automationId: rule.id,
            leadId,
            status: "pending",
            scheduledAt: echeance,
          });
          continue;
        }

        await executeRule(rule, leadId);
      } catch {
        // Une règle qui casse n'empêche pas les autres.
      }
    }
  } catch {
    // Le déplacement du lead et l'import priment sur l'automatisation.
  }
}

/** L'échéance d'une règle depuis l'entrée dans la colonne ; null = tout de suite. */
function echeanceDeRegle(
  rule: { delayMinutes: number; delayDays: number; atHour: number | null },
  entree: Date
): Date | null {
  if (rule.atHour != null) return echeanceTunis(entree, rule.delayDays, rule.atHour);
  if (rule.delayMinutes > 0) return new Date(entree.getTime() + rule.delayMinutes * 60_000);
  return null;
}

/**
 * Meta a mis un modèle en pause, l'a désactivé ou refusé (webhook
 * `message_template_status_update`) : les règles qui l'envoient s'arrêtent
 * d'elles-mêmes — l'API refuserait de toute façon, et insister nourrit la
 * mauvaise note. La raison reste visible dans le dialogue de la règle jusqu'à
 * ce que quelqu'un la réactive.
 */
export async function pauseAutomationsForTemplate(
  template: string,
  language: string,
  reason: string
): Promise<number> {
  const rows = await db
    .update(automations)
    .set({ active: false, pausedReason: reason })
    .where(
      and(
        eq(automations.channel, "whatsapp"),
        eq(automations.whatsappTemplate, template),
        eq(automations.whatsappLanguage, language),
        eq(automations.active, true)
      )
    )
    .returning({ id: automations.id });
  return rows.length;
}

/**
 * Vide la file : envoie les automatisations dont l'échéance est passée.
 *
 * ⚠️ Les garde-fous sont évalués À L'ÉCHÉANCE, pas au moment du déclenchement :
 * entre les deux, le lead a pu se désabonner, changer d'adresse, ou quitter la
 * colonne. Un envoi programmé hier ne doit pas ignorer ce qui s'est passé depuis.
 */
export async function processDueAutomations(): Promise<{
  sent: number;
  cancelled: number;
  failed: number;
  skipped: number;
  postponed: number;
}> {
  const report = { sent: 0, cancelled: 0, failed: 0, skipped: 0, postponed: 0 };

  const due = await db.query.automationRuns.findMany({
    where: and(
      eq(automationRuns.status, "pending"),
      lte(automationRuns.scheduledAt, new Date())
    ),
    limit: 100, // plafond par passage : une file accumulée ne part jamais d'un bloc
  });

  for (const run of due) {
    const rule = await db.query.automations.findFirst({
      where: eq(automations.id, run.automationId),
    });

    if (!rule || !rule.active) {
      await closeRun(run.id, "cancelled", "Automatisation supprimée ou désactivée");
      report.cancelled++;
      continue;
    }

    // Le lead est-il TOUJOURS dans la colonne déclencheuse ?
    const lead = await db.query.leads.findFirst({
      where: eq(leads.id, run.leadId),
      columns: { id: true, statusId: true },
    });
    if (!lead) {
      await closeRun(run.id, "cancelled", "Lead supprimé");
      report.cancelled++;
      continue;
    }
    if (lead.statusId !== rule.statusId) {
      await closeRun(run.id, "cancelled", "Le lead a quitté la colonne avant l'échéance");
      report.cancelled++;
      continue;
    }

    const status = await executeRule(rule, run.leadId, run.id, run.createdAt);
    if (status === "sent") report.sent++;
    else if (status === "failed") report.failed++;
    else if (status === "pending") report.postponed++;
    else if (status === "cancelled") report.cancelled++;
    else report.skipped++;
  }

  return report;
}

async function closeRun(runId: string, status: RunStatus, reason: string) {
  await db
    .update(automationRuns)
    .set({ status, reason })
    .where(eq(automationRuns.id, runId));
}

/**
 * Reporte un envoi au lendemain quand le plafond du jour est atteint.
 * Le run reste `pending` avec son motif : le report est LISIBLE dans le
 * journal, il ne disparaît pas en silence comme un refus de Resend.
 */
async function postpone(
  rule: typeof automations.$inferSelect,
  leadId: string,
  runId?: string,
  quand: Date = tomorrow(),
  reason = `Plafond de ${DAILY_LIMIT} emails/jour atteint — reporté au lendemain`
): Promise<RunStatus> {
  if (runId) {
    await db
      .update(automationRuns)
      .set({ scheduledAt: quand, reason })
      .where(eq(automationRuns.id, runId));
  } else {
    await db.insert(automationRuns).values({
      automationId: rule.id,
      leadId,
      status: "pending",
      scheduledAt: quand,
      reason,
    });
  }
  return "pending";
}

/** Le lead a écrit sur WhatsApp depuis que l'envoi a été programmé ? Alors un humain reprend. */
async function aEcritDepuis(leadId: string, depuis: Date): Promise<boolean> {
  const r = await db.query.activities.findFirst({
    where: and(
      eq(activities.referenceId, leadId),
      eq(activities.type, "whatsapp"),
      eq(activities.direction, "inbound"),
      gt(activities.createdAt, depuis)
    ),
    columns: { id: true },
  });
  return !!r;
}

/**
 * Garde-fous + envoi + journal + trace dans le fil du lead.
 * `runId` fourni = on met à jour la ligne en attente au lieu d'en créer une.
 */
async function executeRule(
  rule: typeof automations.$inferSelect,
  leadId: string,
  runId?: string,
  /** Quand le run a été mis en file : sert à voir si le lead a écrit ENTRE-TEMPS. */
  programmeLe?: Date
): Promise<RunStatus> {
  const { getLeadById, getEmailTemplateById, createActivity, getEmailBranding } =
    await import("@/lib/queries");

  const log = async (status: RunStatus, reason?: string) => {
    if (runId) await closeRun(runId, status, reason ?? "");
    else
      await db
        .insert(automationRuns)
        .values({ automationId: rule.id, leadId, status, reason: reason ?? null });
    return status;
  };

  const lead = await getLeadById(leadId);
  if (!lead) return log("cancelled", "Lead introuvable");

  // ── Canal WhatsApp ────────────────────────────────────────────────
  // Traité avant les garde-fous email : ceux-ci portent sur l'adresse et le
  // désabonnement, qui n'ont pas de sens ici.
  if (rule.channel === "whatsapp") {
    if (!rule.whatsappTemplate) return log("failed", "Aucun modèle WhatsApp sur la règle");
    if (!lead.mobileNo) return log("skipped", "Aucun numéro de téléphone sur le lead");

    const { whatsAppConsentCheck, categorieDuModele, MARKETING_CAP_MS } = await import("@/lib/whatsapp-consent");
    const categorie = await categorieDuModele(rule.whatsappTemplate, rule.whatsappLanguage);
    const marketing = categorie !== "UTILITY" && categorie !== "AUTHENTICATION";
    // Nos garde-fous de confort, pas les règles de Meta : un numéro de test
    // (l'équipe) les saute tous, sinon on ne peut plus rejouer un scénario.
    const { estNumeroDeTest } = await import("@/lib/messaging/whatsapp");
    const test = estNumeroDeTest(lead.mobileNo);

    if (!test) {
      // Un lead qui a déjà payé ne reçoit plus de message de VENTE, même si
      // sa fiche traîne dans une colonne de la pipeline (`converted` ne se
      // remet jamais à faux). Les utilitaires — bienvenue, échéance, rappel
      // d'appel — passent : ils s'adressent justement aux inscrits.
      if (lead.converted && marketing) {
        return log("cancelled", "Le lead est inscrit : plus de message de vente");
      }
      // Une séquence s'arrête dès qu'un humain a repris la conversation.
      if (programmeLe && (await aEcritDepuis(leadId, programmeLe))) {
        return log("cancelled", "Le lead a écrit entre-temps : un humain reprend");
      }
    }

    // Un MARKETING respecte « 1 par 24 h » — reporté, pas annulé : le message
    // reste dû. (La fenêtre 9 h-20 h a été levée le 21/09 : décision Marwen.)
    if (marketing && !test) {
      const dernier = lead.contact?.whatsappMarketingLastAt;
      if (dernier && Date.now() - dernier.getTime() < MARKETING_CAP_MS) {
        const quand = new Date(dernier.getTime() + MARKETING_CAP_MS + 5 * 60_000);
        return postpone(rule, leadId, runId, quand, "Un marketing est déjà parti il y a moins de 24 h : reporté");
      }
    }

    // Règle Meta : pas de marketing sans consentement tracé.
    const garde = await whatsAppConsentCheck(lead.contact, rule.whatsappTemplate, rule.whatsappLanguage);
    if (!garde.ok) return log("skipped", garde.reason);

    // Pas de plafond Resend ici : WhatsApp ne passe pas par lui, et Meta
    // applique le sien (erreur traduite si atteint). Sinon une journée de
    // campagne email repoussait tous les WhatsApp au lendemain.
    // Un modèle en arabe reçoit ses dates en arabe (« 28 سبتمبر »).
    const vars = buildVariables(lead, rule.whatsappLanguage.startsWith("ar"));
    // Meta ne connaît pas les noms : ses modèles portent {{1}}, {{2}}…
    // C'est l'ORDRE de cette liste qui fait la correspondance. Une entrée qui
    // n'est pas une variable du CRM est une valeur fixe, envoyée telle quelle
    // (« lundi 28 septembre, 19h ») : Meta refuse un paramètre vide.
    const noms = (rule.whatsappVariables as string[]) ?? [];
    const valeurs = noms.map((n) => vars[n] ?? n);
    // Meta refuse un paramètre vide (#131008) : dire LAQUELLE des variables
    // manque à ce lead (« offre » sans formule choisie, prénom absent…).
    const vide = noms.find((n, i) => !valeurs[i].trim());
    if (vide) return log("failed", `Variable « ${vide} » vide pour ce lead : Meta refuse un paramètre vide`);

    const { sendWhatsAppTemplate } = await import("@/lib/messaging/whatsapp");
    const envoi = await sendWhatsAppTemplate({
      to: lead.mobileNo,
      template: rule.whatsappTemplate,
      langue: rule.whatsappLanguage,
      variables: valeurs,
      leadId,
    });
    if (!envoi.ok) return log("failed", envoi.error);

    if (runId) {
      await db
        .update(automationRuns)
        .set({ status: "sent", reason: null, sentAt: new Date(), whatsappId: envoi.id })
        .where(eq(automationRuns.id, runId));
    } else {
      await db.insert(automationRuns).values({
        automationId: rule.id,
        leadId,
        status: "sent",
        sentAt: new Date(),
        whatsappId: envoi.id,
      });
    }

    const activite = await createActivity({
      referenceType: "lead",
      referenceId: leadId,
      type: "whatsapp",
      direction: "outbound",
      subject: `WhatsApp automatique — modèle « ${rule.whatsappTemplate} »`,
      // Le texte lu par la personne (le fil et l'assistant en ont besoin), sinon les valeurs.
      content:
        (await (await import("@/lib/messaging/whatsapp")).texteDuModele(rule.whatsappTemplate, valeurs).catch(() => null)) ??
        (valeurs.length ? `Variables : ${valeurs.join(" · ")}` : "Modèle sans variable"),
      createdBy: "automation",
    });
    // Le wamid rattache les accusés (livré, lu, échec) à cette bulle.
    const { recordWhatsAppSent } = await import("@/lib/whatsapp-inbox");
    await recordWhatsAppSent(envoi.id, activite.id, null, rule.whatsappTemplate);
    if (marketing && lead.contactId) {
      await db
        .update(contacts)
        .set({ whatsappMarketingLastAt: new Date() })
        .where(eq(contacts.id, lead.contactId));
    }
    return "sent";
  }

  // Garde-fous repris des campagnes : on n'écrit jamais à quelqu'un qui s'est
  // désabonné ni à une adresse morte.
  if (!lead.email) return log("skipped", "Aucune adresse email sur le lead");
  if (lead.contact?.unsubscribedAt) return log("skipped", "Contact désabonné");
  if (lead.contact?.bouncedAt) return log("skipped", "Adresse en rebond");

  if (!rule.emailTemplateId) return log("failed", "Aucun modèle d'email sur la règle");
  const template = await getEmailTemplateById(rule.emailTemplateId);
  if (!template) return log("failed", "Modèle d'email introuvable");
  if (!template.subject?.trim()) return log("skipped", "Le modèle n'a pas d'objet");

  // Plafond du compte, campagnes comprises. Vérifié ICI, au dernier moment :
  // entre la mise en file et l'échéance, une campagne a pu consommer la journée.
  if ((await sentToday()) >= DAILY_LIMIT) return postpone(rule, leadId, runId);

  // La langue de la date suit celle du modèle — objet compris, car un objet
  // arabe sur un corps français reste un email arabe pour le lecteur.
  const vars = buildVariables(lead, isArabic(`${template.subject ?? ""}${template.content}`));
  const { sendEmail, renderTemplate } = await import("@/lib/messaging/email");
  const { renderEmailTemplate } = await import("@/lib/messaging/markdown");
  const branding = await getEmailBranding();

  // L'objet est du texte brut : substitution simple, sans échappement HTML.
  const subject = renderTemplate(template.subject, vars);
  // ── Désabonnement : exigé par Gmail, et absent jusqu'ici de ce chemin.
  //
  // Les campagnes posent l'en-tête `List-Unsubscribe` depuis toujours ; les
  // automatisations partaient sans rien — ni en-tête, ni lien dans le corps.
  // Gmail exige le désabonnement en UN CLIC des expéditeurs de volume depuis
  // février 2024 : son absence suffit à envoyer l'email en spam (constaté sur
  // un vrai compte Gmail le 2026-09-09).
  const token = lead.contact?.unsubscribeToken;
  const root =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3001";
  const unsubUrl = token ? `${root}/unsubscribe/${token}` : "";
  // En-tête = route API (POST silencieux de Gmail) ; lien du corps = la page.
  const oneClickUrl = token ? `${root}/api/unsubscribe/${token}` : "";

  const footerExtra = unsubUrl
    ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#9ca3af">Vous recevez cet email parce que vous avez demandé des informations sur une formation Space Academy.<br><a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">Se désabonner</a></p>`
    : undefined;

  const html = renderEmailTemplate(
    template.content,
    vars,
    branding ?? undefined,
    {
      enabled: template.buttonEnabled,
      label: template.buttonLabel,
      url: template.buttonUrl,
      position: template.buttonPosition,
    },
    footerExtra
  );

  const res = await sendEmail({
    to: lead.email,
    subject,
    html,
    // Sans jeton on n'invente pas d'en-tête : un `List-Unsubscribe` qui ne
    // désabonne rien est pire que pas d'en-tête du tout.
    headers: unsubUrl
      ? {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
  });
  if (!res.ok) return log("failed", res.error ?? "Échec d'envoi");

  // sentAt distingue le jour de l'envoi du jour de la mise en file : c'est lui
  // que compte le plafond quotidien.
  // `resendId` est écrit ICI, dans le même geste que le statut : c'est le seul
  // fil qui reliera plus tard « ouvert » ou « cliqué » à cette ligne. Sans lui
  // le webhook reçoit l'événement et n'a nulle part où le ranger.
  if (runId) {
    await db
      .update(automationRuns)
      .set({ status: "sent", reason: null, sentAt: new Date(), resendId: res.id ?? null })
      .where(eq(automationRuns.id, runId));
  } else {
    await db.insert(automationRuns).values({
      automationId: rule.id,
      leadId,
      status: "sent",
      sentAt: new Date(),
      resendId: res.id ?? null,
    });
  }

  // Visible dans le fil du lead, attribué à la machine et pas à un humain.
  await createActivity({
    referenceType: "lead",
    referenceId: leadId,
    type: "email",
    direction: "outbound",
    subject,
    content: `Envoi automatique — modèle « ${template.name} »`,
    createdBy: "automation",
  });

  return "sent";
}

type LeadForVars = {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  intendedPlan: string | null;
  bootcamp?: {
    name: string;
    startDate: string | null;
    currency: string | null;
    priceTotal: string | null;
    monthlyCount: number | null;
    monthlyAmount: string | null;
  } | null;
  contact?: { firstName: string | null; lastName: string | null } | null;
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// Mois tels qu'on les dit en Tunisie : formes héritées du français, PAS les
// formes du Moyen-Orient (يناير، فبراير…) qui sonneraient étrangères ici.
const MOIS_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** Le modèle est-il écrit en arabe ? Une seule lettre arabe suffit. */
export function isArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * « 2026-09-28 » → « 28 septembre 2026 », ou « 28 سبتمبر 2026 » en arabe.
 *
 * Découpé à la main plutôt que par `new Date` : la colonne est une date sans
 * heure, et la passer par un Date la fixe à minuit UTC — sur un fuseau négatif
 * l'email annoncerait la veille.
 *
 * Les chiffres restent en 28 / 2026 et non ٢٨ / ٢٠٢٦ : c'est ce qui s'écrit
 * en Tunisie.
 */
function formatStartDate(value: string | null | undefined, arabe = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!m) return "";
  const mois = (arabe ? MOIS_AR : MOIS)[Number(m[2]) - 1];
  return `${Number(m[3])} ${mois} ${m[1]}`;
}

/**
 * Variables utilisables dans l'objet ET dans le corps du modèle.
 *
 * `arabe` vient du modèle lui-même, pas du lead : c'est la langue du texte qui
 * décide de la langue de la date. Un même `{{dateDebut}}` sert donc les deux,
 * sans que personne ait à choisir une seconde variable.
 */
export function buildVariables(lead: LeadForVars, arabe = false): Record<string, string> {
  const firstName = lead.firstName || lead.contact?.firstName || "";
  const lastName = lead.lastName || lead.contact?.lastName || "";
  const b = lead.bootcamp;
  const currency = b?.currency || "TND";

  let offre = "";
  if (lead.intendedPlan === "total" && b?.priceTotal) {
    offre = `${b.priceTotal} ${currency}`;
  } else if (lead.intendedPlan === "monthly" && b?.monthlyCount && b?.monthlyAmount) {
    offre = `${b.monthlyCount}× ${b.monthlyAmount} ${currency}`;
  }

  return {
    firstName,
    lastName,
    fullName: lead.fullName || [firstName, lastName].filter(Boolean).join(" "),
    email: lead.email || "",
    formation: b?.name || "",
    // Vide si la formation n'a pas de date : la phrase du modèle doit tenir
    // sans elle, comme pour `offre`.
    dateDebut: formatStartDate(b?.startDate, arabe),
    offre,
  };
}

/** Variables proposées dans l'interface, pour ne pas les deviner. */
export const AUTOMATION_VARIABLES = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "formation",
  "dateDebut",
  "offre",
] as const;
