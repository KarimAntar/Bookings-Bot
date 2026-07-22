#!/usr/bin/env bash
set -euo pipefail

script=${1:-scripts/health-check.sh}

if ! grep -Fq 'systemctl show bookings-bot.service --property=InvocationID --value' "$script"; then
  printf 'health-check.sh must identify the current systemd invocation\n' >&2
  exit 1
fi
if ! grep -Fq 'journalctl _SYSTEMD_INVOCATION_ID="$invocation_id"' "$script"; then
  printf 'health-check.sh must scope logs to the current invocation ID\n' >&2
  exit 1
fi
if grep -Fq 'ActiveEnterTimestamp' "$script"; then
  printf 'health-check.sh must not use timestamp scoping that can include an old process\n' >&2
  exit 1
fi

printf 'health-check.sh scopes logs to the current systemd invocation\n'
