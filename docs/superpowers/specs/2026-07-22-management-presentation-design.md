# Bookings Bot Management Presentation Design

## Objective

Create a simple, professional HTML slide presentation that lets management understand the Bookings Bot's business purpose, architecture, safety controls, current progress, hosting method, GitHub repository, and next steps without requiring technical knowledge.

## Audience and Tone

The audience is management. Use short statements, plain language, diagrams, and one concrete Slack example. Avoid source-code listings, implementation jargon, API details, and dense technical tables.

The presentation should communicate three messages:

1. The bot provides a consistent first-pass review of booking screenshots.
2. Ambiguous or failed reviews remain under human control.
3. The system is structured for secure operation and future expansion.

## Format

Create one self-contained file at `presentation/index.html`.

The file will:

- Use embedded CSS and JavaScript only.
- Use no framework, package, CDN, web font, or external image.
- Present full-screen slides suitable for a laptop or projector.
- Support previous/next buttons, left/right arrow keys, Home/End, and slide counter.
- Include a visible progress bar.
- Scale to smaller screens.
- Include print styles that render one slide per page for PDF export.
- Respect `prefers-reduced-motion`.
- Use semantic HTML, high color contrast, and accessible button labels.

## Visual Language

Use a restrained navy, blue, white, and green palette. The presentation must prioritize immediate understanding over visual detail.

- Present one main idea per slide.
- Use short headings and no more than four short points on a slide.
- Use large labels and familiar icons or simple geometric shapes.
- Limit every flow diagram to four boxes in one straight line.
- Do not use complex charts, axes, legends, nested diagrams, technical architecture symbols, or decorative data visualizations.
- Explain technical terms in plain language when they first appear. For example, describe Socket Mode as a secure connection from the bot to Slack.
- Use simple arrows to show direction and avoid crossing lines.
- Use cards, status pills, and a simulated Slack thread only where they clarify the message.

Animations will be limited to brief slide transitions and disabled when reduced motion is requested.

## Slide Outline

### 1. Bookings Bot

- Project title.
- Business purpose: automated first-pass booking screenshot review in Slack.
- Current phase: implementation and deployment preparation.

### 2. The Current Problem

- Agents send dashboard screenshots for booking approval.
- Manual checks take time.
- Repeated checks can be inconsistent.
- The team needs a standard first-pass review while retaining human authority.

### 3. The New Method

Show four steps:

1. Agent posts a screenshot.
2. Bookings Bot receives it securely.
3. Gemini reads the visible booking information using defined review instructions.
4. Bookings Bot replies in the original Slack thread.

### 4. Simple Architecture

Show:

```text
Slack -> Bookings Bot on Google VM -> Gemini -> Slack thread reply
```

Explain that Slack Socket Mode uses a secure outbound connection, so no public webhook is required. The bot runs as a TypeScript/Bun service on the existing Google `e2-micro` VM.

### 5. Example Review

Display a simulated Slack thread:

- Agent: booking screenshot and request.
- Bot adds a processing indicator.
- Bot replies: `Needs Human Review` because a payment value is cropped.

The example must be fictional and contain no real prospect data.

### 6. Human Control and Safety

- Unclear image -> human review.
- Missing information -> human review.
- Low AI confidence -> human review.
- AI/network error -> human review.
- Automatic approval is allowed only when the configured policy and confidence threshold are satisfied.

### 7. Project Structure

Use simple component cards:

- Slack connection.
- Image checks.
- Booking review rules.
- Replaceable AI provider.
- Safe logging and monitoring.
- VM deployment and restart supervision.

Explain that the AI provider can be changed later without rebuilding the Slack workflow.

### 8. Security

- Private GitHub repository.
- Credentials stored only in a protected VM environment file.
- No real screenshots or customer information committed.
- Tokens and image bytes excluded from logs.
- Credentials exposed during prototyping must be revoked before production use.

### 9. Work Progress

Completed:

- Business workflow and architecture.
- Google VM hosting decision.
- Strict TypeScript/Bun project scaffold.
- Security and deployment design.
- Detailed implementation plan.

In progress:

- AI review provider.
- Slack image and event handling.
- Automated tests and reliability controls.

Next:

- Private GitHub publication.
- VM deployment.
- Controlled Slack test with synthetic or irreversibly redacted screenshots.
- Organization-specific booking criteria.

### 10. Operations and Cost Control

- Existing Google `e2-micro` VM.
- systemd starts the bot after reboot and restarts it after failures.
- Operators can inspect status and logs with standard Linux commands.
- Free Tier eligibility and outbound data limits must be monitored.
- Google Cloud budget alerts should be configured, but alerts do not automatically cap spending.

### 11. GitHub and Deployment

Show:

```text
Private GitHub -> Google VM -> systemd -> Slack
```

The presentation will contain a clearly marked repository link to the private `Bookings-Bot` GitHub repository. Until the repository exists, the link will be visibly labeled `Repository link pending publication`; it must be replaced before the presentation is considered final. Management needs repository access for a private link to open.

### 12. Next Steps

- Rotate all prototype credentials.
- Complete implementation and automated tests.
- Publish the private GitHub repository.
- Deploy and enable the VM service.
- Validate one complete Slack review flow.
- Supply exact booking approval and rejection criteria.

## Repository Placement and Cleanup

The presentation will be versioned with the bot at `presentation/index.html` and included in the private GitHub repository.

Tracked legacy Hugging Face runtime files (`app.py`, `requirements.txt`, and `Dockerfile`) are removed as part of the Bun migration. Tracked documents and configuration must not refer to `hf_space` or Hugging Face as the active deployment method except where historical context is explicitly necessary; the management presentation will not mention the failed prototype hosting attempts.

The current local repository is physically nested under a directory named `hf_space`. That filesystem rename must occur only after implementation leaves the active linked worktree. The final local project directory should be named `Bookings-Bot`. The internal repository content and GitHub repository will use the same neutral name.

## GitHub Publication

Create a new private GitHub repository named `Bookings-Bot` under the authenticated user's account after implementation, verification, and secret scanning finish. Publishing is an external action and requires confirmation at execution time.

Before pushing:

- Verify the repository is private.
- Scan tracked files and history for Slack, Gemini, and Hugging Face credential patterns.
- Confirm `.env` and generated files are ignored.
- Replace the pending presentation link with the exact GitHub URL.
- Ensure no screenshot containing real prospect information is present.

## Acceptance Criteria

- `presentation/index.html` opens directly in a modern browser without a build step.
- All 12 slides are navigable by controls and keyboard.
- The presentation is readable on a laptop and printable to PDF.
- The simulated booking example contains no real personal data.
- The content accurately reflects the approved Google VM architecture and implementation progress.
- A manager unfamiliar with software architecture can explain the main workflow after viewing the presentation once.
- Every diagram uses no more than four clearly labeled boxes and a single direction of travel.
- No slide contains a complex chart, technical notation, or more than four primary bullet points.
- The presentation contains the final private GitHub repository URL before publication is complete.
- No tracked runtime file or management-facing content uses Hugging Face as the current deployment solution.
