#!/usr/bin/env bash
set -euo pipefail

unit=${1:-deploy/systemd/bookings-bot.service}

if grep -Eq '^MemoryDenyWriteExecute=(true|yes|1)$' "$unit"; then
  printf 'systemd unit blocks executable memory required by Node V8\n' >&2
  exit 1
fi

for directive in \
  'NoNewPrivileges=true' \
  'PrivateTmp=true' \
  'PrivateDevices=true' \
  'ProtectSystem=strict' \
  'ProtectHome=true' \
  'ProtectKernelTunables=true' \
  'ProtectKernelModules=true' \
  'ProtectControlGroups=true' \
  'RestrictSUIDSGID=true' \
  'RestrictNamespaces=true' \
  'LockPersonality=true' \
  'CapabilityBoundingSet=' \
  'AmbientCapabilities='; do
  if ! grep -Fqx "$directive" "$unit"; then
    printf 'systemd hardening directive missing: %s\n' "$directive" >&2
    exit 1
  fi
done

printf 'systemd unit permits Node V8 JIT while retaining service hardening\n'
