# Bookings Bot: Google Cloud VM Deployment Design

## Objective

Deploy Bookings Bot as a continuously running Slack Socket Mode service on the user's existing Google Cloud Compute Engine `e2-micro` VM. Restore the implementation to strict TypeScript on Bun, keep AI-provider coupling replaceable, and supervise the process with systemd.

## Scope

The first release will:

- Listen for new Slack channel messages containing screenshots.
- Download supported images from Slack's private file service.
- Review each booking screenshot against a configurable booking-review prompt.
- Return exactly one decision: `approved`, `needs_human_review`, or `rejected`.
- Reply in the original Slack thread with the decision and concise reasoning.
- Fail safely to `needs_human_review` when automation is uncertain.
- Run continuously on one Google Cloud VM under systemd.

The first release will not include a database, dashboard, local OCR pipeline, public HTTP API, or multiple booking-review profiles. The architecture will leave boundaries for those later additions.

## Hosting Decision

Use the existing Google Compute Engine `e2-micro` VM rather than Hugging Face Spaces. Slack Socket Mode requires a persistent outbound WebSocket, while free demo-oriented hosting can sleep or terminate background processes.

To remain within Google Cloud's Compute Engine Free Tier allowance, the VM should be a non-preemptible `e2-micro` in `us-west1`, `us-central1`, or `us-east1`, with no GPU and no more than 30 GB of standard persistent disk. Billing alerts should be configured, although alerts do not automatically stop spending.

The bot requires outbound internet access but no inbound application port. SSH should be restricted using the user's existing Google Cloud access controls.

## Architecture

```text
Slack channel
  -> Slack Socket Mode event adapter
  -> event validation and deduplication
  -> Slack image downloader
  -> booking review service
  -> AIProvider interface
  -> Gemini vision provider
  -> validated ReviewResult
  -> Slack thread response
```

### Components

- **Application bootstrap:** Loads validated configuration, constructs dependencies, registers Slack listeners, and handles graceful shutdown.
- **Slack adapter:** Converts Slack events into internal review requests, downloads private files, and sends reactions and threaded replies.
- **Review service:** Orchestrates image validation, AI calls, result validation, and safe fallback behavior.
- **AI provider interface:** Defines a provider-independent image review contract.
- **Gemini provider:** Implements the initial vision model integration and structured output request.
- **Review policy:** Stores booking instructions and required output schema independently of the provider implementation.
- **Deduplication cache:** Keeps a bounded, expiring set of Slack event IDs to prevent retry duplication.
- **Structured logger:** Records operational metadata without recording secrets, image bytes, prospect details, or full prompts.

Each component will have one clear responsibility and expose typed contracts so provider or Slack internals can change independently.

## Domain Contract

The provider must produce a value that validates as:

```ts
type ReviewDecision = "approved" | "needs_human_review" | "rejected";

interface ReviewResult {
  decision: ReviewDecision;
  reasoning: string;
  confidence: number;
  extractedFields: Record<string, string | number | boolean | null>;
  flags: string[];
}
```

The model's output is untrusted. Runtime validation will reject malformed decisions, out-of-range confidence, missing reasoning, and invalid extracted data. Any invalid or uncertain response becomes `needs_human_review`.

## Event Processing

1. Receive a Slack message event through Socket Mode.
2. Ignore bot messages, edits, deletions, unsupported channels, and messages without image files.
3. Deduplicate by Slack event ID.
4. Add an `eyes` reaction when possible.
5. Validate the number, MIME type, and declared size of attachments.
6. Download each accepted image with authorization, timeouts, and a byte-size limit.
7. Submit the screenshot and message context to the review service.
8. Validate the AI response.
9. Reply once in the original thread with the consolidated result.
10. Replace the progress reaction with an appropriate terminal reaction when permissions allow.

The service will process only a small bounded number of reviews concurrently because `e2-micro` has limited memory and CPU.

## Safety and Failure Behavior

- Unsupported, corrupt, oversized, or unreadable images produce `needs_human_review`.
- Authentication failures and permanent provider errors are not retried indefinitely.
- Rate limits and transient network failures use bounded exponential backoff with jitter.
- Timeouts apply to Slack downloads and AI requests.
- Uncaught processing errors are contained per event and do not terminate the Socket Mode listener.
- Shutdown signals stop new work and allow current work a short grace period.
- Logs use event IDs and status codes rather than personal booking data.

Automated approval must not occur if required information cannot be confidently extracted. The initial prompt remains conservative until real, redacted screenshot examples and precise booking criteria are supplied.

## Secrets and Security

All credentials previously shared in chat must be considered exposed and revoked before deployment, including Slack tokens, the Slack client secret and verification token, the Gemini key, and the Hugging Face token.

Replacement secrets will be stored on the VM at:

```text
/etc/bookings-bot/bookings-bot.env
```

The file will be readable only by root and the dedicated service account. It will never be committed. The bot will run as an unprivileged `bookings-bot` Linux user with a restricted systemd unit.

Required secrets:

- `SLACK_BOT_TOKEN`
- `SLACK_APP_TOKEN`
- `GEMINI_API_KEY`

Operational configuration will include the Gemini model name, concurrency, timeouts, maximum file size, and optional channel allowlist.

## Repository Structure

```text
src/
  app/
  config/
  domain/
  ai/
  reviews/
  slack/
  observability/
tests/
scripts/
  install-vm.sh
  deploy.sh
  health-check.sh
deploy/systemd/
  bookings-bot.service
.env.example
package.json
tsconfig.json
README.md
```

Generated dependencies, local virtual environments, local secrets, and legacy Hugging Face artifacts will not be part of the production repository.

## VM Installation and Deployment

### One-time installation

`scripts/install-vm.sh` will:

- Require root privileges.
- Install basic system packages.
- Install Bun for the dedicated service user.
- Create `/opt/bookings-bot` and `/etc/bookings-bot`.
- Install the systemd unit.
- Set restrictive ownership and permissions.
- Avoid creating or overwriting the secrets file if it already exists.

### Deployment

`scripts/deploy.sh` will:

- Update the checked-out repository to the configured branch without force-resetting uncommitted operator changes.
- Install dependencies from the lockfile.
- Run formatting checks, type checking, and tests.
- Restart the service only after verification succeeds.
- Confirm that systemd reports the service active after restart.

The documented manual alternative will allow the user to perform each step separately for easier troubleshooting.

### Operations

- Start: `sudo systemctl start bookings-bot`
- Stop: `sudo systemctl stop bookings-bot`
- Restart: `sudo systemctl restart bookings-bot`
- Status: `sudo systemctl status bookings-bot`
- Logs: `sudo journalctl -u bookings-bot -f`

The systemd unit will start after networking, restart on failures with a delay, load the external environment file, set a working directory, and apply practical service hardening compatible with Bun and outbound networking.

## Testing Strategy

- Unit tests for configuration, response validation, deduplication, retry classification, and Slack formatting.
- Provider tests with mocked Gemini responses.
- Slack handler tests with mocked file downloads and replies.
- A startup smoke test that does not require real credentials.
- A manual VM test using rotated credentials and one non-sensitive screenshot.
- Verification that duplicate Slack delivery creates no duplicate reply.
- Verification that model or network failure returns `needs_human_review`.

No live customer screenshot will be committed as a fixture. Future fixtures must be synthetic or irreversibly redacted.

## GitHub Delivery

The repository should be private. Before pushing, the history and working tree must be checked for credentials. Existing exposed credentials must be rotated even if they are absent from the current files.

The GitHub remote is a user-owned repository. Pushing is an external action and will occur only after the user identifies or authorizes the destination repository. VM access to a private repository should use a read-only deploy key or GitHub authentication configured on the VM; credentials must not be embedded in clone URLs or scripts.

## Acceptance Criteria

- The repository installs and passes all checks using Bun.
- The systemd service starts successfully on the `e2-micro` VM.
- The bot establishes Slack Socket Mode without a public HTTP endpoint.
- A supported screenshot receives exactly one threaded review response.
- Invalid or failed reviews resolve to `needs_human_review`.
- A VM reboot automatically restores the service.
- No secrets or personal booking data appear in Git history or routine logs.
