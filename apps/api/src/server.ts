import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectMongo } from './db/mongo.js';
import { attachSocket } from './realtime/gateway.js';
import { config } from './config.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  await connectMongo();
  const app = createApp();
  const httpServer = createServer(app);
  attachSocket(httpServer);

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env }, 'api listening');
  });

  const shutdown = (sig: string) => {
    logger.info({ sig }, 'shutting down');
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'api failed to start');
  process.exit(1);
});
