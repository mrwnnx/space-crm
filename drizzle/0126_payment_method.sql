-- Espèces, virement ou chèque.
--
-- Distinct de `received_by` et complémentaire : le MOYEN dit comment l'argent
-- est arrivé, le DÉTENTEUR dit où il se trouve maintenant. Un virement arrive
-- sur le compte ; des espèces restent dans la poche de qui les a prises. Les
-- confondre, c'est perdre l'une des deux réponses.
alter table payment_schedules
  add column if not exists method text;
