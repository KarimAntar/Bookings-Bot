#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  printf 'Run as root: sudo bash scripts/install-vm.sh\n' >&2
  exit 1
fi

apt-get update
apt-get install -y --no-install-recommends ca-certificates curl git unzip
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y --no-install-recommends nodejs
fi
if ! id bookings-bot >/dev/null 2>&1; then
  useradd --system --home-dir /opt/bookings-bot --create-home --shell /usr/sbin/nologin bookings-bot
fi
install -d -o bookings-bot -g bookings-bot -m 0750 /opt/bookings-bot
install -d -o root -g bookings-bot -m 0750 /etc/bookings-bot
if [[ ! -x /usr/local/bin/bun ]]; then
  install -d -o bookings-bot -g bookings-bot /opt/bookings-bot/.bun
  sudo -u bookings-bot env BUN_INSTALL=/opt/bookings-bot/.bun bash -c 'curl -fsSL https://bun.sh/install | bash'
  ln -sf /opt/bookings-bot/.bun/bin/bun /usr/local/bin/bun
fi
printf 'VM prerequisites installed. Clone the private repository into /opt/bookings-bot/repo next.\n'
