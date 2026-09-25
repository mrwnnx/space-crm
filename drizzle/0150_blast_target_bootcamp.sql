-- La formation d'arrivée choisie à l'envoi d'une vague dont le modèle contient
-- le formulaire « نحب نسجل ». Vide pour toutes les autres vagues.
ALTER TABLE whatsapp_blasts
  ADD COLUMN IF NOT EXISTS target_bootcamp_id uuid REFERENCES bootcamps(id) ON DELETE SET NULL;
