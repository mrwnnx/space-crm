import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────

export const activityTypeEnum = pgEnum("activity_type", [
  "email",
  "whatsapp",
  "sms",
  "note",
  "call",
  "status_change",
  "webhook_in",
]);

export const activityDirectionEnum = pgEnum("activity_direction", [
  "inbound",
  "outbound",
]);

export const cohortStatusEnum = pgEnum("cohort_status", [
  "upcoming",
  "open",
  "full",
  "closed",
  "completed",
]);

export const sequenceStatusEnum = pgEnum("sequence_status", [
  "draft",
  "active",
  "paused",
]);

export const sequenceTriggerEnum = pgEnum("sequence_trigger", [
  "manual",
  "status_change",
  "cohort_missed",
]);

export const messageChannelEnum = pgEnum("message_channel", [
  "email",
  "whatsapp",
  "sms",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "completed",
  "paused",
]);

// ── Tables ─────────────────────────────────────────────

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("slate"),
});

export const cohorts = pgTable("cohorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  capacity: integer("capacity"),
  status: cohortStatusEnum("status").notNull().default("upcoming"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  source: text("source"),
  stageId: uuid("stage_id").references(() => pipelineStages.id),
  score: integer("score").notNull().default(0),
  cohortInterestId: uuid("cohort_interest_id").references(() => cohorts.id),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  lastContactedAt: timestamp("last_contacted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leadActivities = pgTable("lead_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  type: activityTypeEnum("type").notNull(),
  direction: activityDirectionEnum("direction").notNull().default("outbound"),
  subject: text("subject"),
  content: text("content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sequences = pgTable("sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: sequenceTriggerEnum("trigger").notNull().default("manual"),
  status: sequenceStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sequenceSteps = pgTable("sequence_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  channel: messageChannelEnum("channel").notNull(),
  delayDays: integer("delay_days").notNull().default(0),
  subject: text("subject"),
  content: text("content").notNull(),
});

export const sequenceEnrollments = pgTable("sequence_enrollments", {
  id: uuid("id").primaryKey().defaultRandom(),
  sequenceId: uuid("sequence_id")
    .notNull()
    .references(() => sequences.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  currentStep: integer("current_step").notNull().default(0),
  status: enrollmentStatusEnum("status").notNull().default("active"),
  nextStepAt: timestamp("next_step_at"),
  enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
});

// ── Relations ──────────────────────────────────────────

export const pipelineStagesRelations = relations(
  pipelineStages,
  ({ many }) => ({
    leads: many(leads),
  })
);

export const cohortsRelations = relations(cohorts, ({ many }) => ({
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ many, one }) => ({
  stage: one(pipelineStages, {
    fields: [leads.stageId],
    references: [pipelineStages.id],
  }),
  cohortInterest: one(cohorts, {
    fields: [leads.cohortInterestId],
    references: [cohorts.id],
  }),
  activities: many(leadActivities),
  enrollments: many(sequenceEnrollments),
}));

export const leadActivitiesRelations = relations(
  leadActivities,
  ({ one }) => ({
    lead: one(leads, {
      fields: [leadActivities.leadId],
      references: [leads.id],
    }),
  })
);

export const sequencesRelations = relations(sequences, ({ many }) => ({
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}));

export const sequenceStepsRelations = relations(
  sequenceSteps,
  ({ one }) => ({
    sequence: one(sequences, {
      fields: [sequenceSteps.sequenceId],
      references: [sequences.id],
    }),
  })
);

export const sequenceEnrollmentsRelations = relations(
  sequenceEnrollments,
  ({ one }) => ({
    sequence: one(sequences, {
      fields: [sequenceEnrollments.sequenceId],
      references: [sequences.id],
    }),
    lead: one(leads, {
      fields: [sequenceEnrollments.leadId],
      references: [leads.id],
    }),
  })
);

// ── Types ──────────────────────────────────────────────

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Cohort = typeof cohorts.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type Sequence = typeof sequences.$inferSelect;
export type SequenceStep = typeof sequenceSteps.$inferSelect;
export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect;
