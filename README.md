# Bookings Bot

Private Slack bot that reviews booking screenshots with Gemini and conservatively returns approved, rejected, or needs-human-review decisions in a single thread reply.

Repository: https://github.com/KarimAntar/Bookings-Bot

## Slack setup

1. Create a Slack app at https://api.slack.com/apps and enable Socket Mode.
2. Create an app-level token with `connections:write`; store its `xapp-...` value as `SLACK_APP_TOKEN`.
3. Add bot scopes `channels:history`, `groups:history`, `files:read`, `chat:write`, and `reactions:write`.
4. Subscribe the bot to `message.channels` and `message.groups` under Event Subscriptions.
5. Install the app, store its `xoxb-...` token as `SLACK_BOT_TOKEN`, and invite it to each allowed channel.
6. Set `ALLOWED_CHANNEL_IDS` to comma-separated Slack channel IDs. Empty allows every accessible channel.

Never commit credentials. Rotate Slack and Gemini credentials immediately if exposed, then update `/etc/bookings-bot/bookings-bot.env` and restart.

## Local commands

Requires Bun 1.2 or newer for installation/building and Node.js 20 or newer for the Slack Socket Mode runtime.

```bash
cp .env.example .env
# Fill .env with real local credentials
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run build
node --env-file=.env dist/index.js
```

Bun builds the TypeScript application, while Node runs Slack Socket Mode because Slack's WebSocket heartbeat requires an `undici` ping API that Bun does not currently expose. Socket Mode requires no inbound HTTP port.

## Google Compute Engine e2-micro

Create an e2-micro Ubuntu VM with outbound internet access. Memory is limited; keep concurrency low and add swap if installation is killed.

```bash
sudo bash scripts/install-vm.sh
sudo -u bookings-bot git clone git@github.com:KarimAntar/Bookings-Bot.git /opt/bookings-bot/repo
sudo install -o root -g bookings-bot -m 0640 .env.example /etc/bookings-bot/bookings-bot.env
sudoedit /etc/bookings-bot/bookings-bot.env
sudo bash /opt/bookings-bot/repo/scripts/deploy.sh /opt/bookings-bot/repo
```

The private clone requires a read-only GitHub deploy key. Do not put personal access tokens in shell history or clone URLs.

Later deployments:

```bash
sudo -u bookings-bot git -C /opt/bookings-bot/repo pull --ff-only
sudo bash /opt/bookings-bot/repo/scripts/deploy.sh /opt/bookings-bot/repo
```

Service and logs:

```bash
sudo systemctl status bookings-bot
sudo systemctl restart bookings-bot
sudo journalctl -u bookings-bot -f
sudo /opt/bookings-bot/current/scripts/health-check.sh
```

Troubleshooting:

- `invalid_auth`: rotate/check `SLACK_BOT_TOKEN` and restart.
- Socket failures: verify Socket Mode and the app token's `connections:write` scope.
- Missing events: verify subscriptions, scopes, channel invitation, and the allowlist.
- Gemini 401/403: rotate/check `GEMINI_API_KEY` and API access.
- Install killed: add swap or temporarily use a larger VM, then redeploy.
- Restart loop: run `journalctl -u bookings-bot -n 200 --no-pager`.
