-- « Ceux qui entrent dans cette colonne recoivent ce tag. »
-- Independant de l'automatisation d'email : une colonne peut taguer sans
-- envoyer, envoyer sans taguer, ou les deux.
CREATE TABLE IF NOT EXISTS stage_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Une colonne porte AU PLUS une regle de tag : l'unicite est en base, pas
  -- dans l'applicatif, pour qu'un double clic ne cree pas deux regles.
  status_id uuid NOT NULL UNIQUE REFERENCES lead_statuses(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now()
);
