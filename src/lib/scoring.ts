import type { Lead, LeadActivity } from "@/db/schema";

// ── Scoring weights ────────────────────────────────────

const WEIGHTS = {
  hasEmail: 5,
  hasPhone: 5,
  hasWhatsapp: 10,
  cohortInterest: 15,
  inboundReply: 20,
  perActivity: 3, // capped at 24 (8 activities)
  recentContact: 10,
  oldAndCold: -10, // >30 days, no contact, still active stage
};

const HOT_THRESHOLD = 50;
const WARM_THRESHOLD = 25;

// ── Score a single lead ────────────────────────────────

export function calculateScore(
  lead: Pick<
    Lead,
    | "email"
    | "phone"
    | "whatsapp"
    | "cohortInterestId"
    | "lastContactedAt"
    | "stageId"
  >,
  activities: LeadActivity[]
): number {
  let score = 0;

  // Contact completeness
  if (lead.email) score += WEIGHTS.hasEmail;
  if (lead.phone) score += WEIGHTS.hasPhone;
  if (lead.whatsapp) score += WEIGHTS.hasWhatsapp;

  // Cohort interest
  if (lead.cohortInterestId) score += WEIGHTS.cohortInterest;

  // Engagement from activities
  const inboundCount = activities.filter(
    (a) => a.direction === "inbound"
  ).length;
  if (inboundCount > 0) {
    score += WEIGHTS.inboundReply;
    score += (inboundCount - 1) * 10; // bonus per extra reply
  }

  // Activity volume (capped)
  const activityScore = Math.min(activities.length * WEIGHTS.perActivity, 24);
  score += activityScore;

  // Recent contact
  if (lead.lastContactedAt) {
    const daysSince =
      (Date.now() - new Date(lead.lastContactedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince <= 7) score += WEIGHTS.recentContact;
  }

  // Old and cold penalty
  if (lead.lastContactedAt) {
    const daysSince =
      (Date.now() - new Date(lead.lastContactedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince > 30) score += WEIGHTS.oldAndCold;
  } else {
    score += WEIGHTS.oldAndCold;
  }

  return Math.max(0, score);
}

// ── Score tiers ────────────────────────────────────────

export type ScoreTier = "hot" | "warm" | "cold";

export function getScoreTier(score: number): ScoreTier {
  if (score >= HOT_THRESHOLD) return "hot";
  if (score >= WARM_THRESHOLD) return "warm";
  return "cold";
}

export const TIER_CONFIG: Record<
  ScoreTier,
  { label: string; color: string; bg: string; ring: string }
> = {
  hot: {
    label: "Chaud",
    color: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
  },
  warm: {
    label: "Tiède",
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  cold: {
    label: "Froid",
    color: "text-slate-600",
    bg: "bg-slate-50",
    ring: "ring-slate-200",
  },
};
