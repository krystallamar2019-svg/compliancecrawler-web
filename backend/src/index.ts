import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './lib/logger.js';

const app = createApp();

const server = app.listen(config.PORT, '0.0.0.0', () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'BrandedAlign API listening');
});

function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down BrandedAlign API');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'HTTP server shutdown failed');
      process.exit(1);
    }
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
