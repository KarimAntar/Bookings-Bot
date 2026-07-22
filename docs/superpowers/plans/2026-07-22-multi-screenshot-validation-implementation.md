# Multi-Screenshot Booking Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Bookings Bot to validate one booking across CRM, campaign, script, booking-form, and notes screenshots, request precise corrections in the original thread, and re-review corrected evidence.

**Architecture:** Gemini receives all evidence as one package and returns a strict rich review result. A bounded in-memory thread store retains original evidence and latest corrections. The Slack listener reviews every top-level screenshot message regardless of caption and only accepts replies for active review threads.

**Tech Stack:** TypeScript, Bun test/build, Zod, Slack Bolt, Google GenAI, Node runtime.

---

### Task 1: Rich Review Result and Policy

**Files:**
- Modify: `src/domain/review-result.ts`
- Modify: `src/ai/booking-policy.ts`
- Modify: `src/slack/format.ts`
- Test: `tests/domain/multi-review-result.test.ts`

- [ ] Write failing tests asserting:
  - `correction_required` is valid.
  - rich arrays validate screenshot roles, mismatches, missing notes/evidence, failed requirements, and qualification questions.
  - malformed extra fields remain rejected.
  - `needs_human_review` formatting contains `<!here>` while correction formatting does not.
- [ ] Run the focused tests and confirm expected failure.
- [ ] Extend the Zod result schema with strict bounded objects:
  - `evidenceRoles`: `{ imageId, roles[], readable }[]`
  - `crmFields` and `bookingFields`: primitive records
  - `campaignRequirements`: `{ name, requiredValue, actualValue, passed, mustAppearInNotes }[]`
  - `qualificationQuestions`: `{ question, answer, required, presentInNotes }[]`
  - `mismatches`: `{ field, crmValue, bookingValue }[]`
  - `missingNoteEntries`, `missingEvidence`, `failedRequirements`: string arrays
  - status adds `correction_required`
- [ ] Expand the JSON schema to match exactly.
- [ ] Replace the generic policy with explicit rules from the approved design: caption neutrality, evidence classification, normalized core-field matching, authoritative campaign rules, green-check/red-X qualification interpretation, numeric thresholds, note requirements, and four-state decisions.
- [ ] Format concise actionable Slack replies. Human review uses `<!here>`; corrections ask for a thread reply; rejection lists failed rules; approval summarizes checks.
- [ ] Run focused tests, typecheck, and lint.
- [ ] Commit.

### Task 2: Bounded Active Review Thread Store

**Files:**
- Create: `src/slack/review-thread-store.ts`
- Test: `tests/slack/review-thread-store.test.ts`

- [ ] Write failing tests for creating a top-level session, identifying active thread replies, combining original plus latest evidence, replacing the latest correction while retaining original evidence, TTL expiration, and capacity eviction.
- [ ] Run tests and confirm failure.
- [ ] Implement a bounded store keyed by root thread timestamp. Store root channel, root timestamp, original message text/images, latest correction text/images, expiration, and last event ID. Keep no logs of evidence values.
- [ ] Provide `create`, `get`, `applyCorrection`, `has`, and pruning operations.
- [ ] Run tests and checks.
- [ ] Commit.

### Task 3: Top-Level and Correction Message Flow

**Files:**
- Modify: `src/slack/message-listener.ts`
- Modify: `src/app/create-app.ts`
- Test: `tests/slack/message-flow.test.ts`

- [ ] Write failing listener tests proving:
  - every top-level image/file_share message is reviewed regardless of caption, including `test`, `g2g?`, and `@here`.
  - a reply in an active thread with screenshots triggers review using original plus latest evidence.
  - a text-only correction reply is accepted when it supplies requested answers.
  - unrelated thread images are ignored.
  - `message_changed`, deletions, and bot messages are ignored.
  - a correction updates one active session without creating a new root.
- [ ] Run tests and confirm failure.
- [ ] Inject the thread store into listener construction.
- [ ] Separate root submission detection from active-thread correction detection.
- [ ] Download accepted correction screenshots and combine with original evidence. New message text is labeled as correction context and newer screenshots follow original screenshots in the Gemini request.
- [ ] Post every result into the root thread. Keep sessions for `correction_required` and `needs_human_review`; close approved/rejected sessions.
- [ ] Use one processing reaction per pass and terminal reaction matching the result.
- [ ] Run tests, typecheck, and lint.
- [ ] Commit.

### Task 4: Evidence Ordering and Provider Prompt

**Files:**
- Modify: `src/domain/review-request.ts`
- Modify: `src/ai/gemini-provider.ts`
- Test: `tests/ai/multi-image-request.test.ts`

- [ ] Write a failing provider-boundary test that captures the generated Gemini request and proves all original screenshots and correction screenshots are sent in order as one content package, with captions treated only as context.
- [ ] Run and confirm failure.
- [ ] Add evidence source metadata (`original` or `correction`) and stable image IDs to review inputs.
- [ ] Build a text preamble that identifies each image ID and source without assuming screenshot role; Gemini performs classification.
- [ ] Keep temperature zero, strict JSON schema, timeout, and retries.
- [ ] Run tests and checks.
- [ ] Commit.

### Task 5: End-to-End Scenario Verification and Deployment

**Files:**
- Modify: `.env.example` if thread-store limits are configurable
- Modify: `src/config/env.ts`
- Modify: `README.md`
- Test: `tests/slack/booking-scenarios.test.ts`

- [ ] Write scenario tests covering: approved matching package; missing qualification notes -> correction; corrected thread -> approved; minimum-sales failure -> rejected; missing screenshot -> correction; ambiguity -> human review with `<!here>`; caption neutrality.
- [ ] Run and confirm failure where integration gaps remain.
- [ ] Add bounded-store environment defaults if needed (`ACTIVE_REVIEW_TTL_MS`, `MAX_ACTIVE_REVIEWS`).
- [ ] Document the exact screenshot package, correction flow, service-restart limitation, and Slack mention behavior.
- [ ] Run full tests, typecheck, lint, build, and shell checks.
- [ ] Commit and push to `main`.
- [ ] On the VM: pull, set `GEMINI_MODEL` to an available stable model, redeploy, verify health, submit a new multi-screenshot package, reply with a correction, and capture both Slack responses plus current invocation logs.

## Acceptance

All ten scenarios in the approved design must pass. No caption changes eligibility. `<!here>` appears only for human review. Logs and replies avoid hidden reasoning and sensitive data beyond the agent-visible mismatch values needed for correction.
