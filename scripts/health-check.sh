#!/usr/bin/env bash
set -euo pipefail

if ! systemctl is-active --quiet bookings-bot.service; then
  systemctl --no-pager --full status bookings-bot.service >&2 || true
  exit 1
fi
if journalctl -u bookings-bot.service -n 100 --no-pager | grep -q 'Bookings bot started in Slack Socket Mode'; then
  printf 'bookings-bot is active and connected\n'
  exit 0
fi
printf 'bookings-bot is active, but no successful startup marker was found\n' >&2
exit 1
