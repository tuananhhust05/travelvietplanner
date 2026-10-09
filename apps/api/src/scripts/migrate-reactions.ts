/**
 * Phase 1 reactions migration (contract Part 2, section 9).
 *
 * 1. Copies every `likes` doc into `reactions` as type 'like' via batched
 *    bulkWrite upserts using `$setOnInsert` — a reaction the user has since
 *    changed to another type is never overwritten.
 * 2. Recomputes `counts.reactions` / `counts.reactionsTotal` / `counts.comments`
 *    / `counts.saves` for EVERY post from the source collections and `$unset`s
 *    the legacy `counts.likes`.
 *
 * Why a full recompute instead of trusting existing values:
 *  - `counts.comments` has never been incremented (no comment-creation endpoint),
 *  - `counts.likes` was incremented but never read, so it may have drifted.
 * Posts with zero engagement are still written to the zeroed shape, otherwise the
 * API projects `undefined` and the UI renders nothing.
 *
 * Idempotent: safe to run repeatedly. Never drops or modifies `likes` (rollback net).
 *
 * Usage: docker compose exec api node dist/scripts/migrate-reactions.js [--dry-run]
 */
import { ObjectId, type AnyBulkWriteOperation, type Document } from 'mongodb';
import { connectMongo, getDb, getMongoClient } from '../db/mongo.js';

/**
 * Kept local on purpose: this script must typecheck and run independently of
 * reactions.service.ts. Values are fixed by the contract.
 */
const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
type ReactionType = (typeof REACTION_TYPES)[number];
type ReactionCounts = Record<ReactionType, number>;

const LIKE_BATCH = 1000;
const POST_BATCH = 500;
const MAX_DIFF_SAMPLES = 20;

const emptyCounts = (): ReactionCounts => ({
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
});

const isReactionType = (v: unknown): v is ReactionType =>
  typeof v === 'string' && (REACTION_TYPES as readonly string[]).includes(v);

function toOid(value: unknown): ObjectId | null {
  if (value instanceof ObjectId) return value;
  if (typeof value === 'string' && ObjectId.isValid(value)) return new ObjectId(value);
  return null;
}

function toDate(value: unknown, fallback: Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback;
}

/** A bulkWrite upsert can collide with a live write; 11000 means the target row already exists. */
function duplicateKeyOnly(err: unknown): boolean {
  const e = err as { code?: unknown; writeErrors?: unknown };
  const raw = e?.writeErrors;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return e?.code === 11000;
  return list.every((w) => (w as { code?: number }).code === 11000);
}

interface TargetCounts {
  reactions: ReactionCounts;
  reactionsTotal: number;
  comments: number;
  saves: number;
}

interface LikeRow {
  targetId: ObjectId;
  userId: ObjectId;
  createdAt: Date;
}

const dryRun = process.argv.slice(2).some((a) => a === '--dry-run' || a === '-n');
const tag = dryRun ? '[dry-run]' : '[write]';

/**
 * Dry-run only: postId -> number of likes that WOULD be inserted as type 'like'.
 * Without this, a first dry run previews zero reactions for every post because
 * step 2 reads a `reactions` collection that step 1 has not written to yet.
 * Bounded by the number of posts, not the number of likes.
 */
const pendingLikeInserts = new Map<string, number>();

const stats = {
  likesScanned: 0,
  likesMalformed: 0,
  reactionsInserted: 0,
  reactionsAlreadyPresent: 0,
  reactionsUnknownType: 0,
  postsScanned: 0,
  postsChanged: 0,
  postsAlreadyCorrect: 0,
  orphanEngagement: 0,
};

/* ------------------------------------------------------------------ */
/* Step 1 — likes -> reactions                                         */
/* ------------------------------------------------------------------ */

async function flushLikeBatch(rows: LikeRow[]): Promise<void> {
  if (rows.length === 0) return;
  const reactions = getDb().collection('reactions');

  if (dryRun) {
    // Superset query (targetId IN … AND userId IN …), then exact pair matching.
    const seen = await reactions
      .find(
        {
          targetType: 'post',
          targetId: { $in: rows.map((r) => r.targetId) },
          userId: { $in: rows.map((r) => r.userId) },
        },
        { projection: { targetId: 1, userId: 1 } },
      )
      .toArray();
    const present = new Set(seen.map((d) => `${String(d.targetId)}|${String(d.userId)}`));
    for (const r of rows) {
      if (present.has(`${String(r.targetId)}|${String(r.userId)}`)) {
        stats.reactionsAlreadyPresent++;
      } else {
        stats.reactionsInserted++;
        const key = String(r.targetId);
        pendingLikeInserts.set(key, (pendingLikeInserts.get(key) ?? 0) + 1);
      }
    }
    return;
  }

  const ops = rows.map((r) => ({
    updateOne: {
      filter: { targetType: 'post', targetId: r.targetId, userId: r.userId },
      update: {
        $setOnInsert: {
          targetType: 'post',
          targetId: r.targetId,
          userId: r.userId,
          type: 'like',
          createdAt: r.createdAt,
          updatedAt: r.createdAt,
        },
      },
      upsert: true,
    },
  }));

  try {
    const res = await reactions.bulkWrite(ops, { ordered: false });
    stats.reactionsInserted += res.upsertedCount;
    stats.reactionsAlreadyPresent += res.matchedCount;
  } catch (err) {
    if (!duplicateKeyOnly(err)) throw err;
    const partial = (err as { result?: { upsertedCount?: number; matchedCount?: number } }).result;
    stats.reactionsInserted += partial?.upsertedCount ?? 0;
    stats.reactionsAlreadyPresent += partial?.matchedCount ?? 0;
    console.warn(`${tag} duplicate keys in batch (concurrent writer) — already-correct rows, continuing`);
  }
}

async function copyLikes(): Promise<void> {
  const cursor = getDb()
    .collection('likes')
    .find({}, { projection: { postId: 1, userId: 1, createdAt: 1 } })
    .batchSize(LIKE_BATCH);

  const now = new Date();
  let batch: LikeRow[] = [];

  for await (const doc of cursor) {
    stats.likesScanned++;
    const targetId = toOid(doc.postId);
    const userId = toOid(doc.userId);
    if (!targetId || !userId) {
      stats.likesMalformed++;
      continue;
    }
    batch.push({ targetId, userId, createdAt: toDate(doc.createdAt, now) });
    if (batch.length >= LIKE_BATCH) {
      await flushLikeBatch(batch);
      batch = [];
    }
  }
  await flushLikeBatch(batch);

  console.log(
    `${tag} likes: scanned ${stats.likesScanned}, malformed ${stats.likesMalformed}, ` +
      `reactions inserted ${stats.reactionsInserted}, already present ${stats.reactionsAlreadyPresent}`,
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — recompute post counts                                      */
/* ------------------------------------------------------------------ */

/** One aggregation over `reactions`: group by (targetId, type), then fold per target. */
async function loadReactionCounts(): Promise<Map<string, { counts: ReactionCounts; total: number }>> {
  const rows = await getDb()
    .collection('reactions')
    .aggregate<{ _id: unknown; types: { k: unknown; v: number }[] }>(
      [
        { $match: { targetType: 'post' } },
        { $group: { _id: { target: '$targetId', type: '$type' }, n: { $sum: 1 } } },
        { $group: { _id: '$_id.target', types: { $push: { k: '$_id.type', v: '$n' } } } },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  const map = new Map<string, { counts: ReactionCounts; total: number }>();
  for (const row of rows) {
    const counts = emptyCounts();
    let total = 0;
    for (const { k, v } of row.types) {
      if (!isReactionType(k)) {
        // Unreachable via the API (enum-validated) — count it, never guess a bucket.
        stats.reactionsUnknownType += v;
        continue;
      }
      counts[k] += v;
      total += v;
    }
    map.set(String(row._id), { counts, total });
  }
  return map;
}

/** Simple `postId` -> docs count for `comments` / `saves`. */
async function loadPostIdCounts(collection: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .collection(collection)
    .aggregate<{ _id: unknown; n: number }>(
      [{ $group: { _id: '$postId', n: { $sum: 1 } } }],
      { allowDiskUse: true },
    )
    .toArray();
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id === null || row._id === undefined) continue;
    map.set(String(row._id), row.n);
  }
  return map;
}

/** True when the stored counts already match the recomputed shape exactly. */
function alreadyCorrect(stored: unknown, target: TargetCounts): boolean {
  if (typeof stored !== 'object' || stored === null) return false;
  const cur = stored as Record<string, unknown>;
  if ('likes' in cur) return false; // legacy field still needs $unset
  if (cur.reactionsTotal !== target.reactionsTotal) return false;
  if (cur.comments !== target.comments) return false;
  if (cur.saves !== target.saves) return false;
  const r = cur.reactions;
  if (typeof r !== 'object' || r === null) return false;
  const rec = r as Record<string, unknown>;
  if (Object.keys(rec).length !== REACTION_TYPES.length) return false;
  return REACTION_TYPES.every((t) => rec[t] === target.reactions[t]);
}

async function recomputeCounts(): Promise<void> {
  const [reactionMap, commentMap, saveMap] = await Promise.all([
    loadReactionCounts(),
    loadPostIdCounts('comments'),
    loadPostIdCounts('saves'),
  ]);

  if (dryRun) {
    // Step 1 wrote nothing, so fold in the likes it would have copied — otherwise
    // the preview claims every post drops to zero reactions.
    for (const [key, n] of pendingLikeInserts) {
      const cur = reactionMap.get(key) ?? { counts: emptyCounts(), total: 0 };
      cur.counts.like += n;
      cur.total += n;
      reactionMap.set(key, cur);
    }
  }

  console.log(
    `${tag} sources: ${reactionMap.size} posts with reactions, ${commentMap.size} with comments, ` +
      `${saveMap.size} with saves`,
  );

  const posts = getDb().collection('posts');
  const cursor = posts.find({}, { projection: { counts: 1 } }).batchSize(POST_BATCH);
  const touched = new Set<string>();
  let ops: AnyBulkWriteOperation<Document>[] = [];
  let samples = 0;

  const flush = async (): Promise<void> => {
    if (ops.length === 0) return;
    if (!dryRun) await posts.bulkWrite(ops, { ordered: false });
    ops = [];
  };

  for await (const post of cursor) {
    stats.postsScanned++;
    const key = String(post._id);
    touched.add(key);

    const reaction = reactionMap.get(key);
    const target: TargetCounts = {
      reactions: reaction?.counts ?? emptyCounts(),
      reactionsTotal: reaction?.total ?? 0,
      comments: commentMap.get(key) ?? 0,
      saves: saveMap.get(key) ?? 0,
    };

    if (alreadyCorrect(post.counts, target)) {
      stats.postsAlreadyCorrect++;
      continue;
    }
    stats.postsChanged++;

    if (dryRun && samples < MAX_DIFF_SAMPLES) {
      samples++;
      console.log(
        `${tag} post ${key}: ${JSON.stringify(post.counts ?? null)} -> ` +
          `${JSON.stringify(target)}`,
      );
    }

    ops.push({
      updateOne: {
        filter: { _id: post._id },
        update: {
          $set: {
            'counts.reactions': target.reactions,
            'counts.reactionsTotal': target.reactionsTotal,
            'counts.comments': target.comments,
            'counts.saves': target.saves,
          },
          $unset: { 'counts.likes': '' },
        },
      },
    });
    if (ops.length >= POST_BATCH) await flush();
  }
  await flush();

  // Engagement pointing at posts that no longer exist: not fatal, but worth knowing.
  for (const map of [reactionMap, commentMap, saveMap]) {
    for (const key of map.keys()) if (!touched.has(key)) stats.orphanEngagement++;
  }
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log(`${tag} migrate-reactions starting${dryRun ? ' (no writes to reactions/posts)' : ''}`);
  await connectMongo(); // also ensures indexes, including the unique reactions index

  await copyLikes();
  await recomputeCounts();

  console.log('--- totals ---');
  console.log(`mode:                     ${dryRun ? 'dry-run (nothing written)' : 'write'}`);
  console.log(`likes scanned:            ${stats.likesScanned}`);
  console.log(`likes malformed (skipped): ${stats.likesMalformed}`);
  console.log(`reactions inserted:       ${stats.reactionsInserted}`);
  console.log(`reactions already present: ${stats.reactionsAlreadyPresent}`);
  console.log(`reactions unknown type:   ${stats.reactionsUnknownType}`);
  console.log(`posts scanned:            ${stats.postsScanned}`);
  console.log(`posts ${dryRun ? 'to update' : 'updated'}:           ${stats.postsChanged}`);
  console.log(`posts already correct:    ${stats.postsAlreadyCorrect}`);
  console.log(`orphan engagement rows:   ${stats.orphanEngagement}`);
  console.log('`likes` collection left untouched (rollback safety net).');
}

main()
  .then(async () => {
    await getMongoClient().close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('migrate-reactions failed:', err);
    try {
      await getMongoClient().close();
    } catch {
      /* client may never have connected */
    }
    process.exit(1);
  });
