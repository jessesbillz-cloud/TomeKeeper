#!/usr/bin/env bash
# One-shot deploy script for TomeKeeper.
#
# What this does, in order:
#   1. Sets ANTHROPIC_API_KEY as a Supabase edge function secret
#      (only if you pass it as an env var or argument).
#   2. Deploys the three new edge functions:
#      assistant-extract, subscriptions, subscription-watch.
#   3. Builds the frontend.
#
# Usage:
#   ./deploy.sh
#       — assumes ANTHROPIC_API_KEY is already set (skips step 1).
#   ANTHROPIC_API_KEY=sk-ant-... ./deploy.sh
#       — sets/refreshes the secret too.
#
# Prereqs:
#   - supabase CLI installed (`brew install supabase/tap/supabase`)
#   - already linked: `supabase link --project-ref qnsbwdmjrjtbdwkqdtzj`
#   - Node + npm installed (you've already been building the frontend)

set -euo pipefail

cd "$(dirname "$0")"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

if ! command -v supabase >/dev/null 2>&1; then
    red "supabase CLI not found. Install with: brew install supabase/tap/supabase"
    exit 1
fi

# --- 1. Anthropic key (only if provided) -----------------------------------
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    bold "Setting ANTHROPIC_API_KEY secret…"
    supabase secrets set "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}"
    green "  ✓ secret set"
else
    yellow "Skipping secret set (ANTHROPIC_API_KEY not provided in env)."
    yellow "If you've never set it before, run once:"
    yellow "    ANTHROPIC_API_KEY=sk-ant-... ./deploy.sh"
fi

# --- 2. Deploy edge functions ----------------------------------------------
for fn in assistant-extract subscriptions subscription-watch; do
    bold "Deploying $fn…"
    supabase functions deploy "$fn"
    green "  ✓ $fn deployed"
done

# --- 3. Build frontend -----------------------------------------------------
bold "Building frontend…"
( cd frontend && npm run build )
green "  ✓ frontend built → frontend/dist"

bold "All done."
echo
echo "Frontend bundle is in frontend/dist — push it to wherever you host (gh-pages, netlify, etc)."
