import { MongoClient, Db } from 'mongodb';
import { config } from '../config.js';
import { logger } from '../logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongoUri, {
    retryWrites: true,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  db = client.db(config.mongoDb);
  logger.info('mongo connected');
  await ensureIndexes(db);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('mongo not connected');
  return db;
}

export function getMongoClient(): MongoClient {
  if (!client) throw new Error('mongo not connected');
  return client;
}

async function ensureIndexes(database: Db): Promise<void> {
  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('users').createIndex({ handle: 1 }, { unique: true, sparse: true }),
    database.collection('refreshTokens').createIndex({ tokenHash: 1 }, { unique: true }),
    database
      .collection('refreshTokens')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('posts').createIndex({ authorId: 1, createdAt: -1 }),
    database.collection('posts').createIndex({ status: 1, createdAt: -1 }),
    // The feed matches on status + visibility and then sorts `_id` descending.
    // `{status, createdAt}` above sorts on the wrong key, so without this index
    // the feed IXSCANs every published post and blocking-sorts in memory.
    database.collection('posts').createIndex({ status: 1, visibility: 1, _id: -1 }),
    database.collection('comments').createIndex({ postId: 1, createdAt: 1 }),
    // Top-level page: {postId, parentId: null} sorted `_id` descending. Also
    // serves a direct-replies page that is additionally filtered by postId.
    database.collection('comments').createIndex({ postId: 1, parentId: 1, _id: -1 }),
    // Replies are read oldest-first (Facebook order), so the trailing `_id`
    // ascends here. The descending index above cannot serve this without a
    // blocking sort once the reply page is keyed on `parentId` alone.
    database.collection('comments').createIndex({ parentId: 1, _id: 1 }),
    // Materialized-path prefix scans (subtree reads, future cascade ops).
    database.collection('comments').createIndex({ postId: 1, path: 1 }),
    // A single user's comment history, newest first.
    database.collection('comments').createIndex({ authorId: 1, _id: -1 }),
    // `likes` is kept as a read-only backup after the reactions migration.
    database.collection('likes').createIndex({ postId: 1, userId: 1 }, { unique: true }),
    database.collection('likes').createIndex({ postId: 1 }),
    // One reaction per (target, user) — the unique index is what makes the
    // upsert in reactions.service.ts safe against concurrent double-taps.
    database
      .collection('reactions')
      .createIndex({ targetType: 1, targetId: 1, userId: 1 }, { unique: true }),
    // Covers the reaction list when a single type is requested (one tab).
    database
      .collection('reactions')
      .createIndex({ targetType: 1, targetId: 1, type: 1, _id: -1 }),
    // Covers the default "Tất cả" tab, which has no `type` filter. The index
    // above cannot serve it: leaving `type` unconstrained mid-key makes the
    // trailing `_id` ordering per-type, so every page needs a blocking sort.
    database.collection('reactions').createIndex({ targetType: 1, targetId: 1, _id: -1 }),
    database.collection('saves').createIndex({ postId: 1, userId: 1 }, { unique: true }),
    database.collection('saves').createIndex({ userId: 1 }),
    database.collection('follows').createIndex({ followerId: 1, followeeId: 1 }, { unique: true }),
    // The grouping key. UNIQUE is what makes the notification upsert safe against
    // two actors hitting the same post in the same instant — without it, a race
    // inserts two rows for one group and the bell shows duplicates.
    database
      .collection('notifications')
      .createIndex({ userId: 1, type: 1, entityId: 1 }, { unique: true }),
    // The inbox page: filtered by userId, sorted `updatedAt` then `_id` descending
    // so a bumped row returns to the top. `updatedAt` alone is not unique, hence
    // the trailing `_id` — it is also the keyset cursor.
    database.collection('notifications').createIndex({ userId: 1, updatedAt: -1, _id: -1 }),
    // The bell badge counts `{userId, readAt: null}` on every page load. Without
    // this it scans the user's whole notification history to answer.
    database.collection('notifications').createIndex({ userId: 1, readAt: 1 }),
    database.collection('outbox').createIndex({ processedAt: 1, createdAt: 1 }),
    database
      .collection('conversations')
      .createIndex({ participantIds: 1, lastMessageAt: -1 }),
    database.collection('messages').createIndex({ conversationId: 1, seq: 1 }),
    database.collection('admin_boundaries').createIndex({ level: 1, provinceName: 1, name: 1 }),
    database.collection('listings').createIndex({ ownerId: 1, createdAt: -1 }),
    database.collection('listings').createIndex({ ownerId: 1, deletedAt: 1 }),
    // places collection
    database.collection('places').createIndex({ slug: 1 }, { unique: true }),
    database.collection('places').createIndex({ geo: '2dsphere' }, { sparse: true }),
    database.collection('places').createIndex({ type: 1, status: 1 }),
    database.collection('places').createIndex({ ancestors: 1 }),
    database.collection('places').createIndex({ aliases: 1 }),
    // place_articles collection
    database.collection('place_articles').createIndex({ communeSlug: 1, lang: 1 }, { unique: true }),
    database.collection('place_articles').createIndex({ placeId: 1, lang: 1 }, { sparse: true }),
    database.collection('place_articles').createIndex({ status: 1 }),
  ]);
  logger.info('mongo indexes ensured');
}
