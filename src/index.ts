import { createApp } from "./app/create-app";
import { parseEnv } from "./config/env";
import { createLogger } from "./observability/logger";

const startupLogger = createLogger(process.env.LOG_LEVEL);

try {
  const config = parseEnv(process.env);
  const app = createApp(config);
  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    startupLogger.info({ signal }, "Stopping bookings bot");
    try {
      await app.stop();
      process.exitCode = 0;
    } catch (error) {
      startupLogger.error({ err: error }, "Graceful shutdown failed");
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await app.start();
  startupLogger.info("Bookings bot started in Slack Socket Mode");
} catch (error) {
  startupLogger.fatal({ err: error }, "Bookings bot failed to start");
  process.exitCode = 1;
}
