#!/usr/bin/env bash
# Creates the GitHub repo and pushes this history.
# Usage: ./scripts/push-to-github.sh [repo-name] [--private]
set -euo pipefail

REPO_NAME="${1:-supabase-habit-tracker}"
VISIBILITY="${2:---public}"

# Last line of defence: refuse to push if any .env file is tracked.
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'; then
  echo "Refusing to push: the files above contain secrets. git rm --cached them first."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub. Run this first, then re-run this script:"
  echo "  gh auth login"
  exit 1
fi

gh repo create "$REPO_NAME" "$VISIBILITY" --source=. --remote=origin --push
echo
echo "Pushed. Repo URL:"
gh repo view --json url --jq .url
