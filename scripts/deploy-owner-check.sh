#!/usr/bin/env bash
set -euo pipefail

script=${1:-scripts/deploy.sh}

if grep -Fq 'git -C "$repo_dir" archive HEAD | tar' "$script"; then
  printf 'deploy.sh still runs git archive as root through a pipeline\n' >&2
  exit 1
fi

for required in \
  'sudo -u bookings-bot git -C "$repo_dir" archive' \
  'archive=$(mktemp)' \
  'tar -xf "$archive" -C "$release"'; do
  if ! grep -Fq "$required" "$script"; then
    printf 'deploy.sh missing required safe archive step: %s\n' "$required" >&2
    exit 1
  fi
done

printf 'deploy.sh runs archive creation as bookings-bot and extracts only after success\n'
