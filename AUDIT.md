# Academy CRM — Audit qualité (re-analyse)

Date : 25 juin 2026
Contexte : +13 commits, +3 400 lignes depuis le 1er audit

---

## 🔴 Critique — Webhook WhatsApp (double problème)

`src/app/api/webhook/whatsapp/route.ts`

**A. Aucune validation de signature Twilio.** L'endpoint accepte n'importe quel POST. Twilio signe ses requêtes (`X-Twilio-Signature`, HMAC-SHA1) — rien n'est vérifié.

**B. Le webhook est injoignable.** Le matcher de `src/proxy.ts:51` capture tout sauf les assets statiques, et `PUBLIC_ROUTES = ["/login"]` (proxy.ts:4). Un POST de Twilio → `getUser()` null → redirect 307.

**Les deux se combinent :** dès que tu débloques le routage (ajouter `/api/webhook/*` aux routes publiques), la faille A devient immédiatement exploitable.

✅ Bon point : timeline rend le body comme texte (pas de `dangerouslySetInnerHTML`) → pas de XSS stocké.

### Fix appliqué ✅
- `src/proxy.ts` : skip auth si `pathname.startsWith("/api/webhook")`
- `src/app/api/webhook/whatsapp/route.ts` : validation `X-Twilio-Signature` via `twilio.validateRequest()` (graceful degradation si `TWILIO_AUTH_TOKEN` absent)

---

## 🔴 Critique — Aucune autorisation

`getUser()` n'existe que dans `proxy.ts`. ~35 server actions + 2 routes API + tout le DAL s'exécutent sans aucune vérification d'identité ni de propriété.

Symptôme : `saveViewAction` (actions.ts:734) force `userId: null` → les vues « privées » ne sont scopées à personne.

❌ **Non corrigé** — ticket ouvert pour helper `requireUser()`.

---

## 🔴 Critique — signup() ouvert à tous

`src/app/login/actions.ts:18` — self-signup non restreint.

❌ **Non corrigé** — ticket ouvert.

---

## 🟠 Validation & gestion d'erreur quasi nulles

- `zod` n'est jamais importé (pourtant dans les deps). Aucune validation de format (email/url/téléphone/montant).
- `queries.ts` : 0 try/catch sur 839 lignes.
- `actions.ts` : 2 try/catch seulement (import CSV). Une panne DB = exception brute non gérée.

---

## ✅ Corrigé — Bug ilike("___")

`src/lib/queries.ts:311-312` — avant :
```ts
ilike(leads.email, contact.email || "___")
ilike(leads.mobileNo, contact.mobileNo || "___")
```
`_` = wildcard 1 caractère en SQL → `"___"` matche toute chaîne de 3 caractères.

### Fix appliqué ✅
Conditions dynamiques : on n'ajoute le filtre que si la valeur est non-null.

---

## 🟡 Import CSV : correct mais perfectible

- ✅ Pas de mass-assignment (whitelist de champs)
- 🟡 Insert ligne-par-ligne dans une boucle (N requêtes) — pas de batch
- 🟡 Aucune validation de contenu par ligne (emails malformés importés tels quels)
- 🟡 Aucune limite de taille de fichier

---

## 🟡 Toujours présent

- 18 warnings lint (variables mortes, `isPending` non branché à l'UI)
- Aucun index DB sur `activities(referenceType, referenceId)`, `tasks(...)`, `notes(...)`, `*.statusId`, `contacts.organizationId`
- Connexion DB en rôle `postgres` → RLS contournée
- `toNumber` déclaré mais jamais utilisé dans le webhook

---

## ✅ Points solides

- Couche `lib/messaging/*` : try/catch propre, retours `{ok, error}` typés, dégradation gracieuse, `server-only`
- Whitelists de champs sur les updates et l'import (anti mass-assignment)
- Aucun `dangerouslySetInnerHTML` → pas de XSS stocké
- `tsc --noEmit` toujours 0 erreur

---

## Plan de correction recommandé

| # | Action | Pourquoi | Statut |
|---|--------|----------|--------|
| 1 | Webhook : exclure `/api/webhook/*` du proxy + valider `X-Twilio-Signature` | Faille A+B, indissociables | ✅ Fait |
| 2 | Helper `requireUser()` en tête de chaque action + route API + pages | Authz absente partout | ❌ Reste |
| 3 | Restreindre/désactiver `signup()` | Accès libre au CRM | ❌ Reste |
| 4 | Corriger le bug `ilike("___")` | Bug de données réel | ✅ Fait |
| 5 | Schémas zod (create/update/import) + retour d'erreur typé (`useActionState`) | Zéro validation | ❌ Reste |
| 6 | Borne + batch insert sur l'import CSV | Perf/robustesse | ❌ Reste |
| 7 | Index Drizzle + migration | Scans non indexés | ❌ Reste |
