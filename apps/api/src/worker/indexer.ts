import { Client } from '@elastic/elasticsearch';
import { getDb } from '../db/mongo.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

const es = new Client({ node: config.esNode });
const POSTS_INDEX = 'tvp_posts';

export async function ensureEsIndices(): Promise<void> {
  try {
    const exists = await es.indices.exists({ index: POSTS_INDEX });
    if (!exists) {
      await es.indices.create({
        index: POSTS_INDEX,
        mappings: {
          properties: {
            authorId: { type: 'keyword' },
            body: { type: 'text' },
            lang: { type: 'keyword' },
            status: { type: 'keyword' },
            visibility: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      logger.info('created ES index tvp_posts');
    }
  } catch (err) {
    logger.warn({ err }, 'ensureEsIndices failed (ES may be starting)');
  }
}

// Poll outbox, index into ES, mark processed. At-least-once with external version guard.
export async function processOutboxOnce(): Promise<number> {
  const db = getDb();
  const batch = await db
    .collection('outbox')
    .find({ processedAt: null })
    .sort({ createdAt: 1 })
    .limit(50)
    .toArray();
  if (!batch.length) return 0;

  for (const entry of batch) {
    try {
      if (entry.aggregate === 'post' && entry.op === 'index') {
        const post = await db.collection('posts').findOne({ _id: entry.aggregateId });
        if (post && post.status === 'published') {
          await es.index({
            index: POSTS_INDEX,
            id: post._id.toString(),
            version: post.updatedAt.getTime(),
            version_type: 'external_gte',
            document: {
              authorId: post.authorId.toString(),
              body: post.body,
              lang: post.lang,
              status: post.status,
              visibility: post.visibility,
              createdAt: post.createdAt,
            },
          });
        }
      }
      await db.collection('outbox').updateOne({ _id: entry._id }, { $set: { processedAt: new Date() } });
    } catch (err) {
      logger.error({ err, outboxId: entry._id }, 'outbox entry failed; will retry');
    }
  }
  return batch.length;
}
