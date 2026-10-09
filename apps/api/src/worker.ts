import { connectMongo } from './db/mongo.js';
import { ensureEsIndices, processOutboxOnce } from './worker/indexer.js';
import { logger } from './logger.js';

let running = true;

async function main(): Promise<void> {
  await connectMongo();
  await ensureEsIndices();
  logger.info('worker started (outbox indexer)');

  while (running) {
    try {
      const n = await processOutboxOnce();
      if (n === 0) await sleep(1000);
    } catch (err) {
      logger.error({ err }, 'worker loop error');
      await sleep(2000);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const stop = (sig: string) => {
  logger.info({ sig }, 'worker shutting down');
  running = false;
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
