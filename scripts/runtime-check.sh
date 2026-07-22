#!/usr/bin/env bash
set -euo pipefail

node_bin=${1:-node}

"$node_bin" -e '
const major = Number(process.versions.node.split(".")[0]);
const undici = require("undici");
if (major < 20 || typeof undici.WebSocket !== "function" || typeof undici.ping !== "function") {
  throw new Error("Node 20+ with the undici WebSocket ping API is required by Slack Socket Mode");
}
console.log(`Node ${process.versions.node} supports Slack Socket Mode WebSocket ping`);
'
