-- Note interne d'équipe sur une campagne (repris de Kit, « Advanced options »).
-- Visible uniquement en interne, affichée sous l'objet dans la liste.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS internal_note text;
