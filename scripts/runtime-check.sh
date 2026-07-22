#!/usr/bin/env bash
set -euo pipefail

node_bin=${1:-node}

if [[ ! -f node_modules/undici/package.json ]]; then
  printf 'Run this check from an installed application release containing node_modules/undici\n' >&2
  exit 1
fi

"$node_bin" -e '
const major = Number(process.versions.node.split(".")[0]);
const undici = require("undici");
if (major < 20 || typeof undici.WebSocket !== "function" || typeof undici.ping !== "function") {
  throw new Error("Node 20+ with the undici WebSocket ping API is required by Slack Socket Mode");
}
console.log(`Node ${process.versions.node} supports Slack Socket Mode WebSocket ping`);
'
