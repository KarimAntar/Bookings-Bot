# Bookings Bot Management Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, simple HTML slide presentation that explains Bookings Bot to non-technical management and accurately shows project progress, architecture, safety, deployment, and GitHub status.

**Architecture:** One semantic `presentation/index.html` contains all slide markup, styling, and navigation behavior. A small Bun test reads the HTML as text and verifies slide count, required content, navigation/accessibility hooks, print styles, simplified diagrams, and the visibly pending private GitHub link.

**Tech Stack:** HTML5, embedded CSS, vanilla JavaScript, Bun test.

---

## File Map

- Create: `presentation/index.html` — all 12 slides, embedded styles, controls, and navigation.
- Create: `tests/presentation/presentation.test.ts` — structural and content checks without a browser dependency.

### Task 1: Build and Verify the Management Presentation

**Files:**
- Create: `presentation/index.html`
- Create: `tests/presentation/presentation.test.ts`

- [ ] **Step 1: Write the failing presentation test**

Create `tests/presentation/presentation.test.ts`:

```ts
import { describe, expect, test } from "bun:test";

const html = await Bun.file("presentation/index.html").text();

function slideBodies(): string[] {
  return [...html.matchAll(/<section class="slide(?: [^"]*)?"[^>]*>([\s\S]*?)<\/section>/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("management presentation", () => {
  test("contains exactly 12 semantic slides", () => {
    expect(slideBodies()).toHaveLength(12);
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-roledescription="slide"');
  });

  test("contains the required management story", () => {
    for (const phrase of [
      "The Current Problem",
      "The New Method",
      "Simple Architecture",
      "Example Review",
      "Human Control",
      "Project Structure",
      "Security",
      "Work Progress",
      "Operations & Cost Control",
      "GitHub & Deployment",
      "Next Steps",
    ]) {
      expect(html).toContain(phrase);
    }
  });

  test("keeps diagrams simple", () => {
    for (const slide of slideBodies()) {
      const diagramBoxes = (slide.match(/class="flow-box"/g) ?? []).length;
      expect(diagramBoxes).toBeLessThanOrEqual(4);
    }
    expect(html).not.toMatch(/<(canvas|svg)\b/i);
    expect(html).not.toContain("chart.js");
  });

  test("supports controls, keyboard navigation, reduced motion, and printing", () => {
    expect(html).toContain('id="previous-slide"');
    expect(html).toContain('id="next-slide"');
    expect(html).toContain('aria-label="Previous slide"');
    expect(html).toContain('aria-label="Next slide"');
    expect(html).toContain('event.key === "ArrowRight"');
    expect(html).toContain('event.key === "ArrowLeft"');
    expect(html).toContain('event.key === "Home"');
    expect(html).toContain('event.key === "End"');
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toContain("@media print");
    expect(html).toContain("break-after: page");
  });

  test("contains no external assets and clearly marks GitHub publication as pending", () => {
    expect(html).not.toMatch(/<(script|link|img)[^>]+(?:src|href)="https?:\/\//i);
    expect(html).toContain("Repository link pending publication");
    expect(html).toContain('data-repository-status="pending"');
  });

  test("contains no references to Hugging Face or the old hf_space name", () => {
    expect(html.toLowerCase()).not.toContain("hugging face");
    expect(html.toLowerCase()).not.toContain("hf_space");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
bun test tests/presentation/presentation.test.ts
```

Expected: FAIL because `presentation/index.html` does not exist.

- [ ] **Step 3: Create the presentation document shell and simple visual system**

Create `presentation/index.html` with:

- `<!doctype html>`, language, UTF-8, viewport, title, and description.
- A `.deck` containing exactly 12 `<section class="slide">` elements.
- Each section uses `role="region"`, `aria-roledescription="slide"`, a unique `aria-label`, and `aria-hidden` updated by JavaScript.
- Embedded CSS variables for navy, blue, green, amber, red, white, muted text, and border.
- A large title scale, short readable body text, simple cards, status pills, and straight `.flow` layouts.
- `.flow-box` elements only for diagrams; no slide has more than four.
- Fixed previous/next controls, slide counter, and progress bar.
- Responsive CSS that stacks flow boxes vertically below 760px.
- `@media (prefers-reduced-motion: reduce)` that disables transitions.
- `@media print` that shows all slides, hides controls, uses `break-after: page`, and removes shadows.

The top-level shell must use this structure:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="Management presentation for the Bookings Bot Slack screenshot review project."
    />
    <title>Bookings Bot — Management Presentation</title>
    <style>
      /* All styles embedded here. */
    </style>
  </head>
  <body>
    <main class="deck" aria-live="polite">
      <!-- Exactly 12 slide sections. -->
    </main>
    <nav class="controls" aria-label="Presentation controls">
      <button id="previous-slide" type="button" aria-label="Previous slide">← Previous</button>
      <span id="slide-counter" aria-live="polite">1 / 12</span>
      <button id="next-slide" type="button" aria-label="Next slide">Next →</button>
    </nav>
    <div class="progress-track" aria-hidden="true">
      <div id="progress-bar" class="progress-bar"></div>
    </div>
    <script>
      // All navigation embedded here.
    </script>
  </body>
</html>
```

- [ ] **Step 4: Add the 12 plain-language slides**

Use these exact slide titles and content limits:

1. **Bookings Bot** — subtitle `A faster, consistent first review of booking screenshots in Slack`; status pill `Implementation & deployment preparation`.
2. **The Current Problem** — exactly four cards: manual time, repeated checks, inconsistent decisions, need for a standard first pass.
3. **The New Method** — one four-box flow: `Agent posts screenshot` -> `Bot receives it` -> `AI reviews visible details` -> `Bot replies in the thread`.
4. **Simple Architecture** — one four-box flow: `Slack` -> `Bookings Bot` -> `Gemini` -> `Slack reply`; two short notes: runs on existing Google VM, secure bot-to-Slack connection with no public webhook.
5. **Example Review** — fictional Slack-style thread. Agent says `Please review booking BK-1048` and a generic screenshot card shows only invented fields. Bot response says `⚠ Needs Human Review` and `The payment value is cropped, so the booking cannot be approved safely.`
6. **Human Control** — four status cards: unclear image, missing information, low confidence, AI/network failure; every card ends in `Human review`.
7. **Project Structure** — six short component cards, but no connected diagram: Slack connection, image checks, review rules, replaceable AI provider, safe logging, VM service.
8. **Security** — exactly four points: private GitHub, VM-only protected credentials, no customer screenshots in code, tokens/image bytes excluded from logs.
9. **Work Progress** — three columns titled `Completed`, `In progress`, `Next`; each has no more than four short items and reflects actual status as of the scaffold stage.
10. **Operations & Cost Control** — four points: existing e2-micro, systemd auto-start/restart, standard status/log tools, Free Tier and budget monitoring.
11. **GitHub & Deployment** — one four-box flow: `Private GitHub` -> `Google VM` -> `systemd` -> `Slack`; include an `<a data-repository-status="pending" aria-disabled="true">Repository link pending publication</a>` that has no `href` until the private repository is created.
12. **Next Steps** — five numbered items are allowed on this summary slide only: rotate credentials, complete services/tests, publish private GitHub, deploy and test, add exact booking criteria.

Keep each sentence short. Do not add metrics that have not been measured. Do not mention failed hosting experiments.

- [ ] **Step 5: Implement deterministic navigation**

Embed JavaScript that:

```js
const slides = [...document.querySelectorAll(".slide")];
const previousButton = document.querySelector("#previous-slide");
const nextButton = document.querySelector("#next-slide");
const counter = document.querySelector("#slide-counter");
const progressBar = document.querySelector("#progress-bar");
let currentSlide = 0;

function showSlide(index) {
  currentSlide = Math.max(0, Math.min(index, slides.length - 1));
  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === currentSlide;
    slide.classList.toggle("active", active);
    slide.setAttribute("aria-hidden", String(!active));
  });
  counter.textContent = `${currentSlide + 1} / ${slides.length}`;
  progressBar.style.width = `${((currentSlide + 1) / slides.length) * 100}%`;
  previousButton.disabled = currentSlide === 0;
  nextButton.disabled = currentSlide === slides.length - 1;
  history.replaceState(null, "", `#slide-${currentSlide + 1}`);
}

previousButton.addEventListener("click", () => showSlide(currentSlide - 1));
nextButton.addEventListener("click", () => showSlide(currentSlide + 1));

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight" || event.key === "PageDown") showSlide(currentSlide + 1);
  if (event.key === "ArrowLeft" || event.key === "PageUp") showSlide(currentSlide - 1);
  if (event.key === "Home") showSlide(0);
  if (event.key === "End") showSlide(slides.length - 1);
});

const requestedSlide = Number.parseInt(location.hash.replace("#slide-", ""), 10);
showSlide(Number.isFinite(requestedSlide) ? requestedSlide - 1 : 0);
```

Include fallback checks that throw a clear error if controls are absent, while keeping the literal keyboard lines required by the test.

- [ ] **Step 6: Run automated verification**

Run:

```bash
bun test tests/presentation/presentation.test.ts
bun run typecheck
bun run lint
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 7: Perform a browser and print review**

Open the local file in a browser:

```powershell
Start-Process .\presentation\index.html
```

Verify:

- Slides 1 through 12 display without horizontal scrolling at 1366×768.
- Left/right arrows and buttons change one slide at a time.
- Home and End jump correctly.
- The first/last unavailable navigation button is disabled.
- Each diagram is understandable without narration and uses at most four boxes.
- Print Preview produces 12 pages, one slide per page.
- No real customer data, credentials, external requests, or broken assets appear.

If browser automation is available during implementation, use it to capture representative screenshots of slides 1, 4, 5, 9, and 11 and inspect them. Do not add screenshot files to the repository unless they contain only presentation content and are explicitly needed.

- [ ] **Step 8: Commit the presentation**

```bash
git add presentation/index.html tests/presentation/presentation.test.ts
git commit -m "feat: add management progress presentation"
```

The commit message must end with:

```text
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

### Task 2: Replace the Pending Repository Link at Publication Time

**Files:**
- Modify: `presentation/index.html`
- Test: `tests/presentation/presentation.test.ts`

This task runs only after the verified bot repository is created as a private GitHub repository named `Bookings-Bot`.

- [ ] **Step 1: Change the test from pending to published**

Replace the pending-link assertion with:

```ts
test("links to the published private GitHub repository", () => {
  expect(html).not.toContain("Repository link pending publication");
  expect(html).toContain('data-repository-status="published"');
  expect(html).toMatch(/href="https:\/\/github\.com\/[A-Za-z0-9_.-]+\/Bookings-Bot"/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
bun test tests/presentation/presentation.test.ts
```

Expected: FAIL because the presentation still has the pending link.

- [ ] **Step 3: Publish the exact private repository link**

Change slide 11 to:

```html
<a
  class="repository-link"
  data-repository-status="published"
  href="https://github.com/ACTUAL_OWNER/Bookings-Bot"
  target="_blank"
  rel="noreferrer"
>
  Open the private Bookings-Bot repository
</a>
```

Replace `ACTUAL_OWNER` with the authenticated GitHub account discovered when the repository is created. Remove `aria-disabled`.

- [ ] **Step 4: Verify and commit the publication update**

```bash
bun test tests/presentation/presentation.test.ts
bun run check
git diff --check
git add presentation/index.html tests/presentation/presentation.test.ts
git commit -m "docs: link management presentation to GitHub"
```

The commit message must end with:

```text
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
```

---

## Plan Self-Review Results

- **Spec coverage:** All 12 slides, simple diagrams, fictional example, progress, security, private GitHub status, controls, keyboard navigation, responsive layout, reduced motion, accessibility, and print/PDF behavior are covered.
- **Simplicity:** The plan prohibits SVG/canvas charts, limits connected diagrams to four boxes, uses one direction of travel, and limits primary bullets. The project-structure slide uses independent cards rather than a complex diagram.
- **Publication sequencing:** The presentation is usable before GitHub publication with an honest pending label; Task 2 replaces it only after the private repository exists.
- **Placeholder scan:** `ACTUAL_OWNER` appears only as an explicit publication-time operator value with an exact replacement instruction; no implementation ambiguity remains.
