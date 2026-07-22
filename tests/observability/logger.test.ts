import { describe, expect, test } from "bun:test";
import { Writable } from "node:stream";
import { createLogger } from "../../src/observability/logger";

function captureLoggerOutput(
  log: (logger: ReturnType<typeof createLogger>) => void,
): Record<string, unknown> {
  let output = "";
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  const logger = createLogger("info", destination);
  log(logger);

  return JSON.parse(output.trim());
}

describe("createLogger", () => {
  test("redacts deeply nested credentials and image data while retaining useful metadata", () => {
    const entry = captureLoggerOutput((logger) => {
      logger.info({
        eventId: "evt-123",
        status: "processed",
        context: {
          integration: {
            credentials: {
              slackBotToken: "xoxb-secret",
              slackAppToken: "xapp-secret",
              geminiApiKey: "gemini-secret",
              token: "generic-secret",
              authorization: "Bearer secret",
            },
          },
          upload: {
            image: {
              data: "base64-image-secret",
              mimeType: "image/png",
            },
          },
          metadata: {
            data: "useful-non-image-data",
            source: "slack",
          },
        },
      });
    });
    const serialized = JSON.stringify(entry);

    for (const secret of [
      "xoxb-secret",
      "xapp-secret",
      "gemini-secret",
      "generic-secret",
      "Bearer secret",
      "base64-image-secret",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(entry.eventId).toBe("evt-123");
    expect(entry.status).toBe("processed");
    expect(serialized).toContain("useful-non-image-data");
    expect(serialized).toContain("slack");
  });

  test("lets Pino serialize circular objects without exposing nested secrets", () => {
    const context: Record<string, unknown> = {
      eventId: "evt-circular",
      nested: { authorization: "Bearer circular-secret" },
    };
    context.self = context;

    const entry = captureLoggerOutput((logger) => logger.info({ context }));
    const serialized = JSON.stringify(entry);

    expect(serialized).not.toContain("circular-secret");
    expect(serialized).toContain("evt-circular");
    expect(serialized).toContain("[Circular]");
  });
});
