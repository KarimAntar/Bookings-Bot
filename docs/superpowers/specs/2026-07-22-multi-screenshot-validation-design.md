# Multi-Screenshot Booking Validation Design

## Goal

Review every top-level Slack image message as one booking package, regardless of caption, and validate CRM prospect data, campaign rules, qualification questions, booking fields, and booking notes across multiple screenshots. When corrections are possible, request them in the same thread and automatically re-review the original package together with the latest correction evidence.

## Trigger and Thread Scope

- Every top-level channel message containing supported screenshots starts a review, regardless of caption or mentions.
- Captions such as `g2g?`, `good to go?`, `@here g2g?`, or `test booking` are optional context and never affect eligibility.
- All screenshots attached to the top-level message form one booking package.
- Replies in an active review thread are correction evidence. New screenshots are combined with the original package; newer clearly identified values supersede older values for the same field.
- Images in unrelated threads are ignored.
- Edited and deleted Slack messages are ignored to avoid duplicate reviews.
- Active correction threads are stored in a bounded in-memory cache. A service restart requires a new top-level submission.

## Evidence Categories

The model classifies every screenshot or region as one or more of:

1. CRM prospect information
2. Campaign requirements
3. Campaign script
4. Qualification questions
5. Completed booking form
6. Booking notes textarea
7. Unknown or unreadable evidence

A complete review requires enough readable evidence to identify authoritative CRM data, applicable campaign requirements, completed booking fields, booking notes, and required qualification questions.

## Core Field Matching

When visible in both CRM and booking evidence, compare:

- First name
- Last name
- Phone
- Email
- Company or brokerage
- City
- State

Normalize harmless formatting: trim whitespace, compare text and email case-insensitively, remove phone punctuation, and treat state abbreviations/full names as equivalent. Never infer cropped values.

## Campaign Rules

The campaign screenshot is authoritative for campaign eligibility. Extract each rule, whether it applies, its threshold or expected value, the prospect's authoritative CRM value, and whether the script requires that value in booking notes.

For numeric rules such as minimum sales:

- Compare the campaign minimum against the CRM value.
- If the CRM value clearly fails the threshold, reject.
- If the requirement is satisfied but the script says the value must be documented, require the same answer in booking notes.

## Qualification Questions

- Green check beside `Qualification Questions` means questions are required.
- Red X means no qualification-question requirement.
- When required, extract every visible question, locate the corresponding CRM/evidence answer, and require each question/answer in booking notes.
- Missing note answers are correctable and must be listed individually.

## Review States

- `approved`: all required evidence is readable; core fields match; campaign rules pass; qualification questions are answered; required answers appear in notes.
- `correction_required`: evidence is missing, a correctable field mismatch exists, or required note content is absent. Reply with exact items and wait for a thread correction. Do not mention `@here`.
- `needs_human_review`: evidence remains ambiguous, contradictory, unreadable, or low-confidence. Include Slack syntax `<!here>` so people are notified.
- `rejected`: a clearly proven non-correctable campaign eligibility requirement fails, such as CRM sales below an authoritative minimum.

## Structured Result

The model returns a strict structured result containing:

- status and concise reasoning
- confidence
- screenshot/evidence roles
- extracted CRM fields
- extracted booking fields
- campaign requirements
- qualification questions and answers
- notes contents or summarized required entries
- field mismatches
- missing note entries
- missing evidence
- failed requirements
- safe public response flags

The backend validates all model output. Invalid output falls back to `needs_human_review`.

## Slack Responses

Correction responses enumerate exact mismatches, missing screenshots, and missing note answers, then ask the agent to reply in the same thread with updated evidence.

Human-review responses include `<!here>` only for the final `needs_human_review` state.

The bot posts one consolidated response for each review pass and uses reactions as optional progress/terminal indicators.

## Limits and Privacy

- Up to four screenshots per message by default.
- PNG, JPEG, and WebP; 8 MB per image by default.
- Original and correction evidence is held only in bounded process memory.
- Logs include event/thread IDs, state, screenshot count, and generic flags, but exclude names, phones, emails, notes, screenshot bytes, and tokens.

## Acceptance Scenarios

1. Any caption plus top-level screenshots triggers review.
2. Multiple screenshots are analyzed as one package.
3. Matching data and satisfied requirements approve.
4. Missing qualification answers request correction.
5. Corrected thread screenshots trigger complete re-review using original plus latest evidence.
6. Clear minimum-sales failure rejects.
7. Missing evidence requests exact screenshots.
8. Ambiguity triggers `needs_human_review` with `<!here>`.
9. Edited messages and unrelated threads are ignored.
10. Caption wording never changes the booking decision.
