import { describe, expect, test } from "bun:test";

const presentationPath = new URL(
  "../../presentation/index.html",
  import.meta.url,
);
const html = await Bun.file(presentationPath).text();
const slideOpenings = [
  ...html.matchAll(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>/gi),
];
const deckEnd = html.indexOf("</div>", slideOpenings.at(-1)?.index ?? 0);
const slides = slideOpenings.map((opening, index) => {
  const start = opening.index;
  const end = slideOpenings[index + 1]?.index ?? deckEnd;
  return html.slice(start, end);
});
const renderedText = html.replaceAll("&amp;", "&");
const workProgressSlide =
  slides.find((slide) => slide.includes('id="slide-9"')) ?? "";
const workProgressColumns = new Map<string, string[]>();
for (const column of workProgressSlide.matchAll(
  /<article class="work-column"><h3>([^<]+)<\/h3><ul>([\s\S]*?)<\/ul><\/article>/g,
)) {
  const heading = column[1];
  const list = column[2];
  if (!heading || !list) continue;

  const items = [...list.matchAll(/<li>([^<]+)<\/li>/g)].flatMap((item) =>
    item[1] ? [item[1].replaceAll("&amp;", "&")] : [],
  );
  workProgressColumns.set(heading, items);
}

const requiredTitles = [
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
];

describe("management presentation", () => {
  test("contains exactly 12 semantic, accessible slides", () => {
    expect(slides).toHaveLength(12);

    for (const slide of slides) {
      expect(slide).toMatch(/^<section\b[^>]*\brole="region"/i);
      expect(slide).toMatch(/^<section\b[^>]*\baria-roledescription="slide"/i);
      expect(slide).toMatch(/^<section\b[^>]*\baria-hidden="(?:true|false)"/i);
    }
  });

  test("includes the approved titles and key content", () => {
    for (const title of requiredTitles) expect(renderedText).toContain(title);

    expect(html).toContain("Bookings Bot");
    expect(html).toContain(
      "A faster, consistent first review of booking screenshots in Slack",
    );
    expect(html).toContain("Implementation &amp; deployment preparation");
    expect(html).toContain("BK-1048");
    expect(html).toContain("Needs Human Review");
    expect(html).toContain("payment value is cropped");
    expect(html).toContain("No real personal data");
    expect(html).toContain("e2-micro");
    expect(html).toContain("systemd");
  });

  test("keeps diagrams simple and uses no charting technology", () => {
    for (const slide of slides) {
      const flowBoxes = slide.match(/class="[^"]*\bflow-box\b[^"]*"/gi) ?? [];
      expect(flowBoxes.length).toBeLessThanOrEqual(4);
    }

    expect(html).not.toMatch(/<svg\b|<canvas\b|chart\.js/i);
  });

  test("provides accessible controls, title announcements, and keyboard navigation", () => {
    expect(html).toMatch(/id="previous-slide"[^>]*aria-label="[^"]+"/i);
    expect(html).toMatch(/id="next-slide"[^>]*aria-label="[^"]+"/i);
    expect(html).toMatch(/id="slide-counter"(?![^>]*aria-live)[^>]*>/i);
    expect(html).toMatch(
      /id="slide-announcement"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/i,
    );
    expect(html).toContain(
      'const announcement = document.getElementById("slide-announcement")',
    );
    expect(html).toContain(
      `Slide \${visibleNumber} of \${slides.length}: \${title}`,
    );
    expect(html).toContain('role="progressbar"');

    for (const comparison of [
      'event.key === "ArrowRight"',
      'event.key === "PageDown"',
      'event.key === "ArrowLeft"',
      'event.key === "PageUp"',
      'event.key === "Home"',
      'event.key === "End"',
    ]) {
      expect(html).toContain(comparison);
    }

    expect(html).toContain("Math.max(0, Math.min(index, slides.length - 1))");
    expect(html).toContain("window.location.hash");
    expect(html).toMatch(
      /if \(!slides\.length \|\| !previousButton \|\| !nextButton \|\| !counter \|\| !announcement \|\| !progress\)/,
    );
  });

  test("keeps narrow-screen controls reachable without covering slide content", () => {
    expect(html).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*?\.presentation-shell\s*\{[^}]*(?:padding-bottom|padding):\s*[^;}]+/i,
    );
    expect(html).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*?\.controls\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*bottom:)(?=[^}]*z-index:\s*\d+)/i,
    );
    expect(html).toMatch(
      /\.control-button\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/i,
    );
  });

  test("supports reduced motion and print-safe paged output", () => {
    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
    expect(html).toMatch(/@media\s+print/i);
    expect(html).toMatch(/print-color-adjust:\s*exact/i);
    expect(html).toMatch(/-webkit-print-color-adjust:\s*exact/i);
    expect(html).toMatch(
      /@media\s+print[\s\S]*?\.slide(?:\s*,\s*\.slide\.active)?\s*\{[^}]*color:\s*#(?:15283b|000000)/i,
    );
    expect(html).toMatch(
      /@media\s+print[\s\S]*?\.slide::before\s*\{[^}]*background:\s*#[0-9a-f]{6}[^}]*border-bottom:/i,
    );
    expect(html).toMatch(
      /@media\s+print[\s\S]*?\.card[^{]*\{[^}]*background:\s*#(?:ffffff|fbfdff)[^}]*border-color:/i,
    );
    expect(html).toMatch(
      /@media\s+print[\s\S]*?\.card\.standard \.card-mark\s*\{[^}]*background:\s*#e8f3fb;[^}]*color:\s*#071c33;[^}]*border-color:/i,
    );
    expect(html).toMatch(
      /@media\s+print[\s\S]*?\.work-column h3[^{]*\{[^}]*background:\s*#e8f3fb;[^}]*color:\s*#071c33;/i,
    );
    expect(html).toMatch(/break-after:\s*page/i);
  });

  test("has no nested section elements that truncate structural parsing", () => {
    for (const slide of slides) {
      expect(slide.match(/<section\b/gi) ?? []).toHaveLength(1);
    }
    expect(html).toMatch(
      /<article class="conversation" aria-label="Fictional Slack thread">/i,
    );
  });

  test("uses an accessible green numbered marker", () => {
    expect(html).toMatch(
      /\.card\.standard \.card-mark\s*\{[^}]*background:\s*var\(--green-700\);[^}]*color:\s*white/i,
    );
  });

  test("is self-contained and contains no prohibited deployment branding", () => {
    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(html).not.toMatch(/<link\b[^>]*\bhref\s*=/i);
    expect(html).not.toMatch(/<img\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i);
    expect(html).not.toMatch(/hugging face|hf_space/i);
  });

  test("shows accurate Work Progress statuses with no more than four items per column", () => {
    expect(workProgressColumns.get("Completed")).toEqual([
      "Architecture and design approved",
      "Implementation plan approved",
      "TypeScript & Bun scaffold",
    ]);
    expect(workProgressColumns.get("In progress")).toEqual([
      "Core services",
      "Automated tests",
    ]);
    expect(workProgressColumns.get("Next")).toEqual([
      "Publish private GitHub repository",
      "Deploy to VM",
      "Run controlled Slack test",
      "Add organization-specific criteria",
    ]);

    for (const items of workProgressColumns.values())
      expect(items.length).toBeLessThanOrEqual(4);
    expect(workProgressColumns.get("In progress")).not.toContain(
      "TypeScript & Bun scaffold",
    );
    expect(workProgressColumns.get("Completed")).not.toContain("Core services");
    expect(workProgressColumns.get("Completed")).not.toContain("VM setup");
  });

  test("shows the repository as pending without an active link", () => {
    expect(html).toContain("Repository link pending publication");
    expect(html).toMatch(
      /<a\b(?=[^>]*data-repository-status="pending")(?![^>]*\bhref=)[^>]*>\s*Repository link pending publication\s*<\/a>/i,
    );
  });
});
