#!/usr/bin/env bash
set -euo pipefail

if ! systemctl is-active --quiet bookings-bot.service; then
  systemctl --no-pager --full status bookings-bot.service >&2 || true
  exit 1
fi
invocation_id=$(systemctl show bookings-bot.service --property=InvocationID --value)
if [[ -z $invocation_id ]]; then
  printf 'bookings-bot is active, but systemd reported no invocation ID\n' >&2
  exit 1
fi
logs=$(journalctl _SYSTEMD_INVOCATION_ID="$invocation_id" --no-pager)
if grep -Eq 'Failed to send ping to Slack|WebSocket error|Bookings bot failed to start' <<<"$logs"; then
  printf 'bookings-bot is active, but Slack Socket Mode reported an error\n' >&2
  grep -E 'Failed to send ping to Slack|WebSocket error|Bookings bot failed to start' <<<"$logs" >&2
  exit 1
fi
if grep -q 'Bookings bot started in Slack Socket Mode' <<<"$logs"; then
  printf 'bookings-bot is active and connected without Socket Mode errors\n'
  exit 0
fi
printf 'bookings-bot is active, but no successful startup marker was found\n' >&2
exit 1
