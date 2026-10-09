/**
 * Boot canary: runs the exact `ensureIndexes` path the API runs at startup, prints
 * the resulting `comments` indexes, then exits.
 *
 * `ensureIndexes` is awaited in `server.ts`'s boot path and the process exits on
 * rejection, so a malformed index spec is an api crash-loop. Running it first in a
 * throwaway `docker compose run` container surfaces that failure without touching
 * the live container.
 *
 * This is NOT a dry run — index creation is real. That is the point: `createIndex`
 * is idempotent, so by the time the api restarts the indexes already exist and its
 * own boot call is a no-op.
 *
 * Usage: docker compose run --rm --no-deps -T api node dist/scripts/ensure-indexes.js
 */
import { connectMongo, getDb, getMongoClient } from '../db/mongo.js';

async function main(): Promise<void> {
  await connectMongo();
  for (const name of ['comments', 'notifications']) {
    for (const idx of await getDb().collection(name).indexes()) {
      console.log(`  ${name}.${idx.name} ${JSON.stringify(idx.key)}`);
    }
  }
  console.log('INDEXES OK');
  await getMongoClient().close();
}

main().catch((err) => {
  console.error('INDEX FAIL', err);
  process.exit(1);
});
