#!/usr/bin/env bash
# deploy.sh — déploiement build-gated pour space-crm (Academy CRM)
# Usage : ./deploy.sh [--allow-schema] "message de commit"
#
# Flux : garde-fou DB → typecheck → build → commit → push origin/main.
# Vercel redéploie automatiquement à la réception du push.
#
# RÈGLE D'OR DU PROJET : la DB ne suit JAMAIS le push.
# Le SQL s'applique À LA MAIN dans le Supabase SQL Editor, on vérifie, PUIS on pousse le code.
# Pas d'apply-migration en prod. Le garde-fou ci-dessous est intentionnel.

set -euo pipefail

BRANCH="main"
ALLOW_SCHEMA=0

# --- racine du repo (peu importe d'où on lance le script) ---
cd "$(dirname "$0")"

# --- parsing des arguments ---
if [[ "${1:-}" == "--allow-schema" ]]; then
  ALLOW_SCHEMA=1
  shift
fi

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "❌ Message de commit requis."
  echo "   Usage : ./deploy.sh [--allow-schema] \"message de commit\""
  exit 1
fi

# --- garde-fou : on doit être sur main ---
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "❌ Branche courante '$CURRENT_BRANCH' ≠ '$BRANCH'. Bascule sur $BRANCH avant de déployer."
  exit 1
fi

# --- garde-fou DB : STOP si schema.ts ou drizzle/*.sql sont modifiés ---
SCHEMA_CHANGES="$(git status --porcelain | grep -E 'src/db/schema\.ts|drizzle/.*\.sql' || true)"
if [[ -n "$SCHEMA_CHANGES" && "$ALLOW_SCHEMA" -eq 0 ]]; then
  echo "🛑 Changement DB détecté — déploiement stoppé :"
  echo "$SCHEMA_CHANGES" | sed 's/^/     /'
  echo ""
  echo "   RÈGLE D'OR : la DB ne suit pas le push."
  echo "   1. Applique le SQL À LA MAIN dans le Supabase SQL Editor."
  echo "   2. Vérifie que c'est OK en base."
  echo "   3. Relance en confirmant que c'est fait :"
  echo "        ./deploy.sh --allow-schema \"$MSG\""
  exit 1
fi
if [[ -n "$SCHEMA_CHANGES" && "$ALLOW_SCHEMA" -eq 1 ]]; then
  echo "⚠️  --allow-schema actif : je suppose que le SQL a déjà été appliqué à la main dans Supabase."
fi

# --- vérif : typecheck (STOP si échec) ---
echo "▶ Typecheck (npx tsc --noEmit)…"
npx tsc --noEmit

# --- vérif : build (STOP si échec) ---
echo "▶ Build (npx next build)…"
npx next build

# --- commit + push ---
echo "▶ Commit + push vers origin/$BRANCH…"
git add -A
git commit -m "$MSG"
git push origin "$BRANCH"

echo "✅ Poussé sur origin/$BRANCH — Vercel va redéployer automatiquement."
