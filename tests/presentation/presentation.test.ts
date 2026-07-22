import { describe, expect, test } from "bun:test";

const presentationPath = new URL("../../presentation/index.html", import.meta.url);
const html = await Bun.file(presentationPath).text();
const slides = html.match(/<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?<\/section>/gi) ?? [];
const renderedText = html.replaceAll("&amp;", "&");
const workProgressSlide = slides.find((slide) => slide.includes('id="slide-9"')) ?? "";
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
    expect(html).toContain("A faster, consistent first review of booking screenshots in Slack");
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

  test("provides accessible controls, status, and keyboard navigation", () => {
    expect(html).toMatch(/id="previous-slide"[^>]*aria-label="[^"]+"/i);
    expect(html).toMatch(/id="next-slide"[^>]*aria-label="[^"]+"/i);
    expect(html).toMatch(/id="slide-counter"[^>]*aria-live="polite"/i);
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
    expect(html).toMatch(/if \(!slides\.length \|\| !previousButton \|\| !nextButton \|\| !counter \|\| !progress\)/);
  });

  test("supports reduced motion, responsive layouts, and paged printing", () => {
    expect(html).toMatch(/@media\s*\(max-width:\s*760px\)/i);
    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/i);
    expect(html).toMatch(/@media\s+print/i);
    expect(html).toMatch(/break-after:\s*page/i);
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
    expect(workProgressColumns.get("In progress")).toEqual(["Core services", "Automated tests"]);
    expect(workProgressColumns.get("Next")).toEqual([
      "Publish private GitHub repository",
      "Deploy to VM",
      "Run controlled Slack test",
      "Add organization-specific criteria",
    ]);

    for (const items of workProgressColumns.values()) expect(items.length).toBeLessThanOrEqual(4);
    expect(workProgressColumns.get("In progress")).not.toContain("TypeScript & Bun scaffold");
    expect(workProgressColumns.get("Completed")).not.toContain("Core services");
    expect(workProgressColumns.get("Completed")).not.toContain("VM setup");
  });

  test("shows the repository as pending without an active link", () => {
    expect(html).toContain("Repository link pending publication");
    expect(html).toMatch(/<a\b(?=[^>]*data-repository-status="pending")(?![^>]*\bhref=)[^>]*>\s*Repository link pending publication\s*<\/a>/i);
  });
});
