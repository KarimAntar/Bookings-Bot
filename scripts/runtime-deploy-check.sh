#!/usr/bin/env bash
set -euo pipefail

script=${1:-scripts/deploy.sh}

required='sudo -u bookings-bot bash -c '\''cd "$1" && exec bash scripts/runtime-check.sh /usr/bin/node'\'' _ "$release"'

if ! grep -Fq "$required" "$script"; then
  printf 'deploy.sh must run runtime-check via bash from the release directory\n' >&2
  exit 1
fi

printf 'deploy.sh runs runtime-check from the installed release with bash\n'
