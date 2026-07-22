import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const presentationPath = new URL(
  "../../presentation/index.html",
  import.meta.url,
);
const browserCandidates = [
  process.env.CHROME_PATH,
  Bun.which("google-chrome"),
  Bun.which("google-chrome-stable"),
  Bun.which("chromium"),
  Bun.which("chromium-browser"),
  Bun.which("chrome"),
  Bun.which("msedge"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  join(
    process.env.LOCALAPPDATA ?? "",
    "Google",
    "Chrome",
    "Application",
    "chrome.exe",
  ),
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter((candidate): candidate is string => Boolean(candidate));
const browserPath = browserCandidates.find(existsSync);

let server: ReturnType<typeof Bun.serve> | undefined;
let browser: ReturnType<typeof Bun.spawn> | undefined;
let browserProfile: string | undefined;
let cdp: CdpClient | undefined;
let browserStartupError: Error | undefined;

class CdpClient {
  readonly #socket: WebSocket;
  readonly #pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  #nextId = 1;

  private constructor(socket: WebSocket) {
    this.#socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        result?: unknown;
        error?: { message: string };
      };
      if (!message.id) return;

      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  static connect(url: string): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new CdpClient(socket)), {
        once: true,
      });
      socket.addEventListener(
        "error",
        () =>
          reject(new Error("Could not connect to browser debugging session")),
        {
          once: true,
        },
      );
    });
  }

  send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close(): void {
    this.#socket.close();
  }
}

async function waitForBrowser(port: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch {
      // Chrome may need a moment to open its debugging endpoint.
    }
    await Bun.sleep(100);
  }
  throw new Error("Headless browser did not expose its debugging endpoint");
}

async function evaluate<T>(expression: string): Promise<T> {
  if (!cdp) throw new Error("Browser session is not ready");
  const response = await cdp.send<{
    result: { value?: T; description?: string };
    exceptionDetails?: unknown;
  }>("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails)
    throw new Error(response.result.description ?? "Browser evaluation failed");
  return response.result.value as T;
}

async function waitFor(expression: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await evaluate<boolean>(expression)) return;
    await Bun.sleep(50);
  }
  throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

beforeAll(async () => {
  if (!browserPath) return;

  try {
    server = Bun.serve({
      port: 0,
      routes: {
        "/": () =>
          new Response(Bun.file(presentationPath), {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      },
    });

    browserProfile = await mkdtemp(
      join(tmpdir(), "bookings-presentation-chrome-"),
    );
    const debuggingPort = 9_500 + Math.floor(Math.random() * 400);
    browser = Bun.spawn([
      browserPath,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${browserProfile}`,
      "about:blank",
    ]);

    await waitForBrowser(debuggingPort);
    const targetResponse = await fetch(
      `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent(`http://127.0.0.1:${server.port}/`)}`,
      { method: "PUT" },
    );
    const target = (await targetResponse.json()) as {
      webSocketDebuggerUrl: string;
    };
    cdp = await CdpClient.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await waitFor(
      'document.readyState === "complete" && document.querySelectorAll(".slide").length === 12',
    );
  } catch (error) {
    browserStartupError =
      error instanceof Error ? error : new Error(String(error));
  }
}, 20_000);

afterAll(async () => {
  if (cdp) {
    try {
      await cdp.send("Browser.close");
    } catch {
      // The browser may already have closed after the test.
    }
    cdp.close();
  }
  if (browser) {
    browser.kill();
    await browser.exited;
  }
  server?.stop(true);
  if (browserProfile) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await rm(browserProfile, { recursive: true, force: true });
        break;
      } catch {
        await Bun.sleep(100);
      }
    }
  }
});

test.skipIf(!browserPath)(
  "headless presentation behavior, mobile controls, and print PDF",
  async () => {
    if (browserStartupError) throw browserStartupError;
    const initial = await evaluate<{
      active: string | null;
      hidden: string[];
      counter: string;
      hash: string;
    }>(`(() => ({
    active: document.querySelector('.slide.active')?.id ?? null,
    hidden: [...document.querySelectorAll('.slide')].map((slide) => slide.getAttribute('aria-hidden')),
    counter: document.getElementById('slide-counter')?.textContent ?? '',
    hash: location.hash,
  }))()`);
    expect(initial).toEqual({
      active: "slide-1",
      hidden: ["false", ...Array.from({ length: 11 }, () => "true")],
      counter: "1 / 12",
      hash: "#slide-1",
    });

    expect(
      await evaluate<
        Array<{
          href: string;
          target: string;
          rel: string;
          status: string;
          ariaDisabled: string | null;
        }>
      >(
        `(() => [...document.querySelectorAll('#slide-11 a')].map((link) => ({
          href: link.href,
          target: link.target,
          rel: link.rel,
          status: link.dataset.repositoryStatus,
          ariaDisabled: link.getAttribute('aria-disabled'),
        })))()`,
      ),
    ).toEqual([
      {
        href: "https://github.com/KarimAntar/Bookings-Bot",
        target: "_blank",
        rel: "noreferrer",
        status: "published",
        ariaDisabled: null,
      },
      {
        href: "https://github.com/KarimAntar/Bookings-Bot-Presentation",
        target: "_blank",
        rel: "noreferrer",
        status: "published",
        ariaDisabled: null,
      },
    ]);

    await evaluate("document.getElementById('next-slide')?.click()");
    await waitFor("location.hash === '#slide-2'");
    expect(
      await evaluate<string | undefined>(
        "document.querySelector('.slide.active')?.id",
      ),
    ).toBe("slide-2");
    expect(
      await evaluate<string | undefined>(
        "document.getElementById('slide-announcement')?.textContent",
      ),
    ).toBe("Slide 2 of 12: The Current Problem");

    if (!cdp) throw new Error("Browser session is not ready");
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "End",
      code: "End",
    });
    await cdp.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "End",
      code: "End",
    });
    await waitFor("location.hash === '#slide-12'");
    expect(
      await evaluate<string | null | undefined>(
        "document.querySelector('.slide.active')?.getAttribute('aria-hidden')",
      ),
    ).toBe("false");

    await evaluate("location.hash = '#slide-6'");
    await waitFor("document.querySelector('.slide.active')?.id === 'slide-6'");
    expect(
      await evaluate<string | null | undefined>(
        "document.getElementById('slide-counter')?.textContent",
      ),
    ).toBe("6 / 12");

    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 375,
      height: 667,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const mobile = await evaluate<{
      position: string;
      top: number;
      bottom: number;
      viewportHeight: number;
      buttonHeights: number[];
      shellPaddingBottom: number;
    }>(`(() => {
    const controls = document.querySelector('.controls');
    const rect = controls.getBoundingClientRect();
    return {
      position: getComputedStyle(controls).position,
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: innerHeight,
      buttonHeights: [...controls.querySelectorAll('button')].map((button) => button.getBoundingClientRect().height),
      shellPaddingBottom: Number.parseFloat(getComputedStyle(document.querySelector('.presentation-shell')).paddingBottom),
    };
  })()`);
    expect(mobile.position).toBe("fixed");
    expect(mobile.top).toBeGreaterThanOrEqual(0);
    expect(mobile.bottom).toBeLessThanOrEqual(mobile.viewportHeight);
    expect(mobile.buttonHeights.every((height) => height >= 44)).toBe(true);
    expect(mobile.shellPaddingBottom).toBeGreaterThan(
      mobile.viewportHeight - mobile.top,
    );

    await cdp.send("Emulation.clearDeviceMetricsOverride");
    await cdp.send("Emulation.setEmulatedMedia", { media: "print" });
    const printVisibility = await evaluate<{
      headings: boolean;
      marker: boolean;
      topRule: boolean;
      markerTextContrast: string;
      workHeadingTextContrast: string;
    }>(`(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' &&
        style.color !== 'rgba(0, 0, 0, 0)' && rect.width > 0 && rect.height > 0;
    };
    const headings = [document.querySelector('#slide-1 h1'), document.querySelector('#slide-5 h2'), document.querySelector('#slide-12 h2')];
    const marker = document.querySelector('#slide-2 .card.standard .card-mark');
    const workHeading = document.querySelector('#slide-9 .work-column h3');
    const topRule = getComputedStyle(document.querySelector('#slide-1'), '::before');
    return {
      headings: headings.every(visible),
      marker: visible(marker) && getComputedStyle(marker).borderStyle !== 'none',
      topRule: topRule.display !== 'none' && topRule.borderBottomStyle !== 'none',
      markerTextContrast: getComputedStyle(marker).color,
      workHeadingTextContrast: getComputedStyle(workHeading).color,
    };
  })()`);
    expect(printVisibility).toEqual({
      headings: true,
      marker: true,
      topRule: true,
      markerTextContrast: "rgb(7, 28, 51)",
      workHeadingTextContrast: "rgb(7, 28, 51)",
    });

    const pdf = await cdp.send<{ data: string }>("Page.printToPDF", {
      landscape: true,
      printBackground: false,
      preferCSSPageSize: true,
    });
    const pdfSource = Buffer.from(pdf.data, "base64").toString("latin1");
    expect(pdfSource.match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(12);
  },
  30_000,
);
