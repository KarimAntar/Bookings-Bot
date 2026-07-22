import pino from "pino";

const REDACTED = "[REDACTED]";
const sensitiveKeys = new Set([
  "authorization",
  "geminiapikey",
  "image",
  "images",
  "slackapptoken",
  "slackbottoken",
  "token",
]);

function redactSensitiveValues(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (Buffer.isBuffer(value) || value instanceof Date || value instanceof Error) {
    return value;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) clone.push(redactSensitiveValues(item, seen));
    return clone;
  }

  const clone: Record<string, unknown> = {};
  seen.set(value, clone);
  for (const [key, nestedValue] of Object.entries(value)) {
    clone[key] = sensitiveKeys.has(key.toLowerCase())
      ? REDACTED
      : redactSensitiveValues(nestedValue, seen);
  }
  return clone;
}

export function createLogger(
  level = "info",
  destination?: pino.DestinationStream,
): pino.Logger {
  return pino(
    {
      level,
      base: { service: "bookings-bot" },
      hooks: {
        logMethod(args, method) {
          const redactedArgs = args.map((arg) => redactSensitiveValues(arg));
          method.apply(this, redactedArgs as Parameters<typeof method>);
        },
      },
    },
    destination,
  );
}

export const logger = createLogger(process.env.LOG_LEVEL);
