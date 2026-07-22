#!/usr/bin/env bash
set -euo pipefail

repo_dir=${1:-/opt/bookings-bot/repo}
release_root=/opt/bookings-bot/releases
release="$release_root/$(date -u +%Y%m%d%H%M%S)"

if [[ ${EUID} -ne 0 ]]; then
  printf 'Run as root: sudo bash scripts/deploy.sh [repo-directory]\n' >&2
  exit 1
fi
if [[ ! -f /etc/bookings-bot/bookings-bot.env ]]; then
  printf 'Missing /etc/bookings-bot/bookings-bot.env\n' >&2
  exit 1
fi
install -d -o bookings-bot -g bookings-bot -m 0750 "$release_root"
install -d -o bookings-bot -g bookings-bot -m 0750 "$release"
git -C "$repo_dir" archive HEAD | tar -x -C "$release"
chown -R bookings-bot:bookings-bot "$release"
sudo -u bookings-bot /usr/local/bin/bun install --frozen-lockfile --cwd "$release" --production
ln -sfn "$release" /opt/bookings-bot/current
chown -h bookings-bot:bookings-bot /opt/bookings-bot/current
install -o root -g root -m 0644 "$release/deploy/systemd/bookings-bot.service" /etc/systemd/system/bookings-bot.service
systemctl daemon-reload
systemctl enable --now bookings-bot.service
systemctl restart bookings-bot.service
"$release/scripts/health-check.sh"
