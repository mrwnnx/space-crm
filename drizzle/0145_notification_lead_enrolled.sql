-- Une notification « inscription » distincte : c'est elle qui fait sonner le
-- tiroir-caisse dans la cloche. Hors transaction : ADD VALUE l'exige.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'lead_enrolled';
