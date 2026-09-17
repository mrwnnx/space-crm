// Module pur (pas de server-only) : partagé entre l'API et le formulaire client.

/** Les secteurs que Meta accepte pour le champ `vertical` du profil WhatsApp. */
export const WHATSAPP_VERTICALS: { code: string; label: string }[] = [
  { code: "EDU", label: "Éducation" },
  { code: "PROF_SERVICES", label: "Services professionnels" },
  { code: "ENTERTAIN", label: "Divertissement" },
  { code: "EVENT_PLAN", label: "Événementiel" },
  { code: "NONPROFIT", label: "Association" },
  { code: "ONLINE_STORE", label: "Boutique en ligne" },
  { code: "OTHER", label: "Autre" },
];
