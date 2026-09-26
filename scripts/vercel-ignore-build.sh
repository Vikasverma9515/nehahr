#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 = skip this deployment, exit 1 = build.
#
# The Vercel project only hosts the Next.js dashboard. Pushes that change just
# the Python backend, the voice agent, the Meet bot, SQL migrations or docs
# don't need a new dashboard deployment (they deploy to Render / LiveKit).

set -u
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$BASE" ] || ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  BASE="HEAD^"
fi
if ! git cat-file -e "$BASE^{commit}" 2>/dev/null; then
  echo "No previous commit to compare with: building."
  exit 1
fi

if git diff --quiet "$BASE" HEAD -- . \
    ':(exclude)backend' ':(exclude)voice_agent' ':(exclude)meet_bot' \
    ':(exclude)supabase' ':(exclude)docs' ':(exclude)render.yaml' \
    ':(exclude).github' ':(exclude)*.md'; then
  echo "Only non-dashboard files changed since $BASE: skipping the Vercel build."
  exit 0
fi
echo "Dashboard files changed since $BASE: building."
exit 1
