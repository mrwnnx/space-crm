# Assistant conversationnel du Space CRM — conception

**Date** : 2026-09-14
**État** : conception validée point par point avec Marwen. **Aucune ligne de code écrite.**
**Maquettes** : https://claude.ai/code/artifact/1bd8f954-1a60-4d77-bfc6-dd32e787c16b

---

## 1. Le problème, mesuré

Mesures prises sur la base de production les 12 et 14 septembre 2026.

| | |
|---|---|
| Leads | **847** |
| **Jamais appelés ni emailés** | **786** |
| Appels notés | **25**, sur 20 leads |
| Notes libres | **0** |
| Commentaires | 17 |
| Lectures IA existantes | 322 |
| `motivation` remplie | 82, dont **3 détaillées** |
| **`wants_call` = oui** | **111** (non : 54 · vide : 682) |
| `intended_plan` | 107 mensuel · 61 comptant |
| **Inscrits** | **4** |

Deux conclusions qui commandent toute la conception :

1. **Comprendre un lead est déjà possible** — le formulaire, le fil, les ouvertures,
   les clics et les changements de colonne sont tous en base. Rien à ajouter.
2. **Il n'y a presque rien à mémoriser**, parce que rien n'est écrit après les appels.
   25 appels notés pour 847 leads. Une table de mémoire serait vide.

Donc le levier n'est pas la mémoire, c'est **ce qui la remplit**. C'est ce qu'un
assistant conversationnel fait mieux qu'un formulaire : on lui parle en sortant d'un
appel, il range.

Et il faut le dire franchement : avec 786 leads jamais touchés, le problème de Marwen
n'est pas le manque d'analyse, c'est que personne ne décroche le téléphone. L'assistant
peut mettre la liste dans la main chaque matin ; composer le numéro reste humain.

---

## 2. Ce qui rend le projet court

- Le SDK Anthropic est **déjà branché** : `src/lib/ai/lead-insights.ts`,
  modèle `claude-opus-5`, sorties structurées via `zodOutputFormat`.
- **Les 86 actions serveur de `src/app/actions.ts` sont les outils de l'agent.**
  Il appelle ce que les boutons appellent — aucune logique métier à réécrire.
- Le coût n'est pas l'agent : c'est **l'aperçu** de chaque action écrivante.
  D'où le choix de peu d'actions, bien faites.

---

## 3. Décisions arrêtées

### 3.1 Il lit **et** il agit
Écarté : un assistant en lecture seule. Marwen veut les deux.

### 3.2 Aperçu obligatoire avant **chaque** écriture
L'agent annonce ce qu'il va faire, montre la **liste nominative** de ce qui change,
et n'écrit qu'après validation. Sans exception, sans seuil.

Écartés :
- **Le seuil** (petits gestes automatiques, gros gestes validés) — il faudrait trancher
  « petit/gros » pour 86 actions, et c'est là qu'on se trompe.
- **La confiance totale** — 115 emails partis ne reviennent pas, une inscription crée
  un échéancier.

### 3.3 Douze actions au départ

| Lire | Agir |
|---|---|
| chercher des leads (colonne, tag, formation, engagement) | changer de colonne |
| lire une fiche complète | poser / retirer un tag |
| historique d'appels et d'emails | noter un appel |
| statistiques d'une automatisation | créer une tâche de rappel |
| file d'appels du jour | changer l'offre |
| lecture IA existante d'un lead | envoyer un modèle d'email |

**Hors de portée volontairement** : inscrire, supprimer, modifier une formation,
les paramètres, l'équipe. Une erreur y coûte cher et Marwen est de toute façon devant
son écran pour ces gestes-là.

### 3.4 On ne stocke que ce qui n'est pas recalculable
- Ce qui a été **dit** → mémoire durable, datée, contredisable.
- Ce qui se **déduit** des données → recalculé à chaque demande, **jamais figé**.

Sans cette règle, une analyse de juin contredit le fil de septembre et plus personne ne
sait laquelle croire.

### 3.5 Règle de Marwen — pas de champ → note datée
> « si quelque chose ne se trouve pas dans le champ, tu le rajoutes en tant que note,
> c'est très important »

Exemples donnés : « il paie par virement », « il vient de la part de X ». Ça n'aura
jamais de champ et ça vaut de l'or au téléphone. **Rien de ce qui est dit n'est jeté.**

### 3.6 L'agent écrit dans `qualification`, jamais dans `temperature`
Le CRM porte deux champs qui disent « chaud » et ne sont pas la même chose :

- **`temperature`** (cold/hot) = ce que le lead **a fait**. Posée par la machine : la
  source du formulaire (`lib/lead-intake.ts`), un clic dans un email
  (`api/webhook/resend`), ou la création manuelle. Affichée dans la **liste** des leads.
  3 leads chauds / 847.
- **`qualification`** (chaud, tiede, froid, pas_serieux, hors_cible, reporte) = ce que
  Marwen **a entendu**. Écrite à un seul endroit :
  `components/leads/call-outcome-form.tsx`. 5 leads / 847.

**La file d'appels ne lit que `qualification`.** Écrire dans l'autre champ donnerait
« je l'ai mis chaud » sans que rien ne bouge dans la file.

### 3.7 Placement : panneau à droite
Validé par Marwen sur maquettes le 2026-09-14.

Il se glisse par-dessus l'écran courant **sans le décaler**, et connaît la fiche
ouverte — on dit « lui », pas le nom complet. C'est le seul placement où la fiche du
lead et la proposition d'écriture tiennent dans le même regard ; comme tout passe par
une validation, relire sans pouvoir vérifier la fiche revient à valider à l'aveugle.

Écartés : la **barre centrale ⌘K** (elle couvre exactement ce qu'il faut contrôler, et
un aperçu long la fait déborder) et la **page dédiée seule** (aucun contexte).

La page dédiée n'est pas abandonnée : elle **prolonge** le panneau au lot 2 — même
conversation, deux fenêtres.

### 3.8 Aucune reconnaissance vocale n'est construite
« Dicter » = le micro du clavier iOS/Android ou la dictée macOS. L'assistant reçoit du
texte et ne sait pas qu'il a été dicté. Aucun micro ouvert, aucun service de
transcription.

### 3.9 La note s'affiche sur 100, pas en étoiles
Les étoiles ne disent rien de plus que « bien / moins bien » et ne se règlent pas.
Un chiffre, **toujours accompagné de ses raisons** :
`82 — a demandé qu'on l'appelle · brochure puis inscription · paiement comptant`.

### 3.10 Poids en dur pour la v1, écran de réglage ensuite
Marwen ne saura pas quoi régler avant d'avoir vu la note tourner deux semaines sur de
vrais leads.

---

## 4. Le geste central : la dictée après appel

C'est le produit, pas la conversation.

> « je viens d'appeler Mohamed, il vient samedi à 14 h, il veut payer par virement,
> je le trouve chaud, c'est Fatma qui le reçoit »

→ **une seule fiche à valider**, cinq écritures qui partent ensemble ou pas du tout :

```
Mohamed Bouazizi — UX/UI Bootcamp september 2026

  Appel noté            aujourd'hui 11:20
  Faits retenus         vient samedi 14h · paiement par virement
  Qualification         — → chaud             (note : 45 → 145)
  Tâche                 « Recevoir Mohamed » sam. 14h → Fatma
  Colonne               Nouveau → Intéressé

        [ Valider ]   [ Corriger ]   [ Annuler ]
```

« Corriger » rouvre **une seule ligne** ; le reste n'est jamais à réécrire.

### Correspondance vérifiée en base

| Ce qui est dit | Champ réel | État |
|---|---|---|
| « il vient samedi 14 h » | `tasks.start_date` | existe |
| « c'est Fatma qui le reçoit » | `tasks.assigned_to` = `contact.fatmaghorbel@gmail.com` (5 tâches déjà) | existe |
| « je le trouve chaud » | `leads.qualification` | existe |
| « il paie en 3 fois » | `leads.intended_plan` | existe |
| « rappelle-le le 1er octobre » | `leads.next_follow_up_at` | existe |
| « il paie par virement » | aucun champ → **note datée** | règle 3.5 |

**Le calendrier est alimenté par les tâches** (`app/(dashboard)/calendar/page.tsx`
importe `getTasks`). Une seule création apparaît aux deux endroits — rien à construire
pour « mets-le dans mon calendrier ».

---

## 5. La note du lead

### 5.1 Ce score existe déjà, caché
`getCallQueue()` (`src/lib/queries.ts`, ~ligne 2370) calcule déjà une formule lisible
où chaque lead porte ses raisons :

| Signal | Points |
|---|---|
| brochure **puis** inscription | +45 |
| a cliqué dans l'email (vidéo repérée à part) | +40 |
| qualifié « chaud » par Marwen | +40 (tiède +15 · froid −25 · pas sérieux −70 · reporté −40 · hors cible −100) |
| lecture IA « sérieux » | +50 (curieux +25 · hors cible −100) |
| rappel prévu échu | +60 — **programmé plus tard : −80** |
| jamais appelé | +30 |
| n'avait pas répondu | +20 |
| jours sans bouger | +1/j, plafonné à 20 |
| a choisi une formule | +10 |
| a ouvert l'email | +8 (faible exprès : Gmail et Apple préchargent le pixel) |
| pas encore vu | +5 |
| appelé il y a moins de 3 jours | −60 |

**Le problème n'est pas qu'il manque un score : c'est qu'il est invisible sur la fiche
et que Marwen ne peut pas le régler.**

### 5.2 Les trois manques révélés par ses exemples
1. **`wants_call` ne vaut 0 point.** 111 personnes ont explicitement demandé qu'on les
   appelle — le signal le plus évident n'est pas dans la formule.
2. `intended_plan` donne **+10 quel que soit le plan** : comptant et facilité traités
   pareil, alors que Marwen les distingue.
3. Le **métier** (157 leads renseignés) n'est pas utilisé.

### 5.3 Aucun poids ne peut être appris
**4 inscrits dans toute la base.** `wants_call` = oui : 1/111. Motivation détaillée :
0/3. Comptant : 2/61. Aucune statistique ne dira si « comptant » vaut +20 ou +5.

→ La formule reste **lisible** et devient **celle de Marwen**, réglable dans un écran.
Pas de modèle qui apprend, pas de boîte noire.

### 5.4 Deux notes, pas une
La formule actuelle mélange deux questions, ce qui produit des absurdités : un excellent
lead affiche une note basse **parce qu'il a été appelé hier**.

- **Note du lead** (sur 100) — *qui il est*. Stable : demande d'appel, brochure +
  inscription, formule choisie, motivation, métier, clics.
- **Ordre d'appel** — *quand l'appeler*. La note, plus le temps : rappel prévu, appelé
  récemment, jours sans bouger.

Chacune affiche ses raisons à côté du chiffre.

---

## 6. Découpage en lots

Chaque lot est utilisable à sa fin. Les outils qui écrivent arrivent **en dernier,
exprès** : rien ne touche la base avant que le reste soit éprouvé.

> **Le lot 5 est détachable.** La note du lead améliore la file d'appels que l'assistant
> existe ou non — elle ne dépend d'aucun des lots précédents et pourrait passer devant
> si Marwen la juge plus urgente. Elle est décrite ici parce qu'elle est née de la même
> conversation, pas parce qu'elle en dépend.

### Lot 0 — préalable (Marwen)
- [ ] **Renouveler la clé Anthropic.** Elle expire vers le 30/09/2026. Aujourd'hui son
      expiration coûte la lecture IA des leads ; avec l'assistant, c'est le CRM qui
      devient muet.

### Lot 1 — le socle et la lecture
- [ ] Panneau latéral droit, en superposition, ouvert par un bouton et par `⌘J`.
      Plein écran sous `lg`.
- [ ] Le panneau connaît la page courante ; sur une fiche lead, « lui » désigne ce lead.
- [ ] Boucle d'outils sur `@anthropic-ai/sdk`, réponse en flux, dans un module neutre
      (ni `"use client"`, ni `"server-only"` au mauvais étage).
- [ ] Les 6 outils de lecture : chercher des leads · fiche complète · historique
      appels/emails · statistiques d'automatisation · file d'appels · lecture IA existante.
- [ ] Journal des échanges par utilisateur, pour que la conversation survive au
      rafraîchissement.
- [ ] Garde-fou de coût : plafond de jetons par échange, et message clair quand la clé
      est absente ou expirée — **jamais un échec silencieux**.

### Lot 2 — l'analyse et la page dédiée
- [ ] « Analyse ce lead » : rassemble formulaire, fil, engagement, appels et faits
      mémorisés, rend une lecture **recalculée à chaque fois** (jamais stockée).
- [ ] Réutilise `src/lib/ai/lead-insights.ts` plutôt que de le dupliquer.
- [ ] Page `/assistant` dans le menu : même conversation, fenêtre large, pour la
      question du matin.

### Lot 3 — la mémoire
- [ ] Table de faits : `lead_id`, texte, date de l'énoncé, auteur, source, et le fait
      qui le contredit le cas échéant.
- [ ] Extraction depuis une phrase dictée → **aperçu** → écriture après validation.
- [ ] Les faits d'un lead sont relus automatiquement avant toute analyse le concernant.
- [ ] Affichage des faits sur la fiche, avec leur date.
- [ ] Un fait peut être corrigé ou marqué caduc, jamais effacé en silence.

### Lot 4 — les outils qui écrivent
- [ ] Les 6 actions : colonne · tag · appel noté · tâche de rappel · offre · envoi d'un
      modèle d'email.
- [ ] **Un aperçu par action**, nominatif, avec le nombre exact de leads touchés.
- [ ] Aperçu groupé : une dictée qui déclenche cinq écritures se valide **en une fois**.
- [ ] « Corriger » rouvre une seule ligne.
- [ ] Toute écriture de l'agent est attribuée dans le fil du lead — on doit pouvoir dire
      plus tard « c'est l'assistant qui a fait ça ».

### Lot 5 — la note du lead
- [ ] Séparer `getCallQueue()` en **note du lead** et **ordre d'appel**.
- [ ] Ajouter `wants_call`, distinguer comptant/facilité, utiliser le métier.
- [ ] Afficher la note sur la fiche et sur la vignette kanban, **toujours avec ses raisons**.
- [ ] Écran de réglage des poids (après deux semaines d'observation, cf. 3.10).

---

## 7. Risques

| Risque | Parade |
|---|---|
| **La clé Anthropic expire** et le CRM devient muet | Lot 0. Message d'erreur explicite, jamais un silence |
| L'agent écrit dans `temperature` au lieu de `qualification` | Ce champ n'est pas exposé comme outil |
| Le coût par échange dérape | Plafond de jetons, outils de lecture bornés en nombre de lignes |
| Une extraction fausse écrit n'importe quoi | Aucune écriture sans aperçu validé (3.2) |
| L'aperçu devient si long que Marwen valide sans lire | Une ligne par écriture, jamais de pavé ; « Corriger » ligne à ligne |
| La mémoire reste vide comme les notes d'appel | La dictée est le seul chemin d'alimentation, et elle prend trois secondes |

---

## 8. Points encore ouverts

- Faut-il un **historique consultable** des échanges avec l'assistant, ou la
  conversation du jour suffit-elle ?
- Fatma doit-elle avoir accès à l'assistant, et avec les mêmes 12 actions ?
- Que fait l'agent quand la dictée mentionne **un lead qui n'existe pas** — proposer de
  le créer, ou refuser ?
