import { ObjectId, ClientSession, type Document } from 'mongodb';
import { getDb, getMongoClient } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { resolveAddress, resolveByNames, type AdminAddress } from '../geo/geo.service.js';
import { EMPTY_COUNTS, removeReaction, setReaction } from './reactions.service.js';

export interface CreatePostInput {
  authorId: string;
  body: string;
  lang?: 'vi' | 'en';
  media?: { url: string; type: 'image' | 'video' }[];
  placeId?: string;
  place?: { name: string; lat?: number; lng?: number };
  address?: { province: string; commune: string };
  visibility?: 'public' | 'followers';
}

export async function createPost(input: CreatePostInput) {
  const db = getDb();
  const client = getMongoClient();
  const now = new Date();

  // Store the structured commune/province, not raw coordinates. An explicit
  // province/commune pick wins over coordinates; it is validated against the
  // boundary data so a client cannot store names that do not exist.
  let address: AdminAddress | null = null;
  if (input.address) {
    address = await resolveByNames(input.address.province, input.address.commune);
    if (!address) {
      throw new ApiError(400, 'unknown_address', 'Province/commune not found');
    }
  } else if (input.place?.lat != null && input.place?.lng != null) {
    address = await resolveAddress(input.place.lat, input.place.lng);
  }

  const post = {
    authorId: new ObjectId(input.authorId),
    body: input.body,
    lang: input.lang ?? 'vi',
    media: input.media ?? [],
    placeId: input.placeId ? new ObjectId(input.placeId) : null,
    place: input.place ?? null,
    address,
    visibility: input.visibility ?? 'public',
    // Posts are visible immediately — there is no async media-processing
    // pipeline that would transition a 'processing' post to 'published'.
    status: 'published',
    // Denormalized engagement counters. Reads never $lookup the reaction
    // collection, so this shape must exist from the moment a post is created.
    counts: {
      reactions: { ...EMPTY_COUNTS },
      reactionsTotal: 0,
      comments: 0,
      saves: 0,
    },
    createdAt: now,
    updatedAt: now,
  };

  // Post + outbox in one transaction (source of truth → derived ES index).
  const session: ClientSession = client.startSession();
  let postId: ObjectId;
  try {
    await session.withTransaction(async () => {
      const r = await db.collection('posts').insertOne(post, { session });
      postId = r.insertedId;
      await db.collection('outbox').insertOne(
        {
          aggregate: 'post',
          aggregateId: postId,
          op: 'index',
          payload: { status: post.status },
          createdAt: now,
          processedAt: null,
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return { id: postId!.toString(), status: post.status };
}

export async function getPost(id: string, viewerId?: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid post id');
  const items = await db
    .collection('posts')
    .aggregate([
      { $match: { _id: new ObjectId(id) } },
      ...engagementStages(viewerId),
      { $project: POST_PROJECT },
    ])
    .toArray();
  if (items.length === 0) throw new ApiError(404, 'not_found', 'Post not found');
  return items[0];
}

/**
 * Shared author lookup + engagement stages appended to a posts pipeline.
 *
 * Counts come from the denormalized `counts` sub-document on the post — we no
 * longer $lookup the whole likes/saves/comments collections per post, which
 * would not scale with six reaction types. Only the viewer's own reaction and
 * save are looked up, and each of those is a single-document probe on a unique
 * index (not a full-collection join).
 */
function engagementStages(viewerId?: string): Document[] {
  const viewerOid = viewerId && ObjectId.isValid(viewerId) ? new ObjectId(viewerId) : null;

  const stages: Document[] = [
    {
      $lookup: {
        from: 'users',
        localField: 'authorId',
        foreignField: '_id',
        as: 'author',
      },
    },
    { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        reactions: { $ifNull: ['$counts.reactions', { $literal: { ...EMPTY_COUNTS } }] },
        // Clamp: legacy drift could leave a negative counter behind.
        reactionsTotal: { $max: [0, { $ifNull: ['$counts.reactionsTotal', 0] }] },
        commentCount: { $max: [0, { $ifNull: ['$counts.comments', 0] }] },
        saveCount: { $max: [0, { $ifNull: ['$counts.saves', 0] }] },
      },
    },
    // Separate stage on purpose: sibling fields of a single $addFields are all
    // evaluated against the *input* document, so `$reactionsTotal` is only
    // visible once the stage above has been applied.
    { $addFields: { likeCount: '$reactionsTotal' } },
  ];

  if (viewerOid) {
    stages.push(
      {
        $lookup: {
          from: 'reactions',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$targetType', 'post'] },
                    { $eq: ['$targetId', '$$pid'] },
                    { $eq: ['$userId', viewerOid] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { type: 1 } },
          ],
          as: '_vr',
        },
      },
      {
        $lookup: {
          from: 'saves',
          let: { pid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$postId', '$$pid'] },
                    { $eq: ['$userId', viewerOid] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { _id: 1 } },
          ],
          as: '_vs',
        },
      },
      {
        $addFields: {
          viewerReaction: { $ifNull: [{ $first: '$_vr.type' }, null] },
          viewerLiked: { $gt: [{ $size: '$_vr' }, 0] },
          viewerSaved: { $gt: [{ $size: '$_vs' }, 0] },
        },
      },
    );
  } else {
    stages.push({
      $addFields: { viewerReaction: null, viewerLiked: false, viewerSaved: false },
    });
  }

  return stages;
}

const POST_PROJECT = {
  _id: 1,
  body: 1,
  lang: 1,
  media: 1,
  placeId: 1,
  place: 1,
  address: 1,
  visibility: 1,
  status: 1,
  // Auto-created feed posts for tours/listings carry a link back to the source
  // entity, so the client can deep-link to the detail page instead of the post.
  serviceId: 1,
  listingId: 1,
  createdAt: 1,
  updatedAt: 1,
  reactions: 1,
  reactionsTotal: 1,
  viewerReaction: 1,
  // `likeCount`/`viewerLiked` are compatibility aliases for web clients built
  // before reactions shipped. Remove once the new web bundle is fully rolled out.
  likeCount: 1,
  viewerLiked: 1,
  commentCount: 1,
  saveCount: 1,
  viewerSaved: 1,
  author: {
    _id: '$author._id',
    displayName: '$author.displayName',
    handle: '$author.handle',
    avatarUrl: '$author.avatarUrl',
    accountType: '$author.accountType',
  },
};

/**
 * Cursor for `_id`-based keyset pagination.
 *
 * The next page is fetched with `_id < cursor`, so the cursor MUST be the
 * smallest `_id` on this page — never `items[items.length - 1]._id`. As soon as
 * the pipeline sorts by anything other than `_id` (score, `createdAt`) the last
 * item's `_id` sits somewhere in the middle of the page, and every post with a
 * larger `_id` that is not on this page becomes unreachable on every subsequent
 * page: the user silently loses posts while scrolling.
 */
function minIdCursor(items: Document[]): string | null {
  let min: string | null = null;
  for (const item of items) {
    const id = item._id;
    if (!(id instanceof ObjectId)) continue;
    // Hex is 24 lowercase chars, so lexicographic order matches byte order.
    const hex = id.toHexString();
    if (min === null || hex < min) min = hex;
  }
  return min;
}

export async function listFeed(opts: {
  limit: number;
  before?: string;
  viewerId?: string;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const query: Record<string, unknown> = { status: 'published', visibility: 'public' };
  if (opts.before && ObjectId.isValid(opts.before)) {
    query._id = { $lt: new ObjectId(opts.before) };
  }

  // The ranking window is exactly one page. It used to over-fetch `limit * 3`
  // and keep only the top `limit` by score, which permanently discarded two
  // thirds of every window: the cursor can only move past the window, so the
  // posts that lost the score cut were never served on any page. Scoring now
  // orders the page it is given instead of selecting from a larger window, so
  // `_id`-keyset paging stays complete (every post is on exactly one page).
  const items = await db
    .collection('posts')
    .aggregate([
      { $match: query },
      { $sort: { _id: -1 } },
      { $limit: limit },
      ...engagementStages(opts.viewerId),
      {
        $addFields: {
          score: {
            $add: [
              { $divide: [1, { $add: [1, { $ln: { $add: [1, { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3_600_000] }] } }] }] },
              { $multiply: [0.35, { $ln: { $add: [1, { $add: [{ $multiply: ['$reactionsTotal', 1] }, { $multiply: ['$commentCount', 3] }, { $multiply: ['$saveCount', 2] }] }] } }] },
            ],
          },
        },
      },
      { $sort: { score: -1, _id: -1 } },
      { $project: POST_PROJECT },
    ])
    .toArray();

  // Score-sorted, so the last row is NOT the oldest one — take the true minimum.
  const nextCursor = minIdCursor(items);
  return { items, nextCursor };
}

/**
 * Posts authored by a single user (most recent first), plus profile stats
 * (post/follower/following counts) so a profile page can render in one call.
 */
export async function listMyPosts(opts: {
  userId: string;
  limit: number;
  before?: string;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const query: Record<string, unknown> = {
    authorId: new ObjectId(opts.userId),
    status: 'published',
  };
  if (opts.before && ObjectId.isValid(opts.before)) {
    query._id = { $lt: new ObjectId(opts.before) };
  }

  const items = await db
    .collection('posts')
    .aggregate([
      { $match: query },
      { $sort: { createdAt: -1, _id: -1 } },
      // No re-ranking here: the sort key before and after the engagement stages
      // is identical, so the top `limit` of a `limit * 3` window is exactly the
      // first `limit` rows. Over-fetching only paid for 3x the $lookups.
      { $limit: limit },
      ...engagementStages(opts.userId),
      { $sort: { createdAt: -1, _id: -1 } },
      { $project: POST_PROJECT },
    ])
    .toArray();

  const [postCount, followerCount, followingCount] = await Promise.all([
    db.collection('posts').countDocuments(query),
    db.collection('follows').countDocuments({ followeeId: new ObjectId(opts.userId) }),
    db.collection('follows').countDocuments({ followerId: new ObjectId(opts.userId) }),
  ]);

  // Sorted by `createdAt` but paged by `_id`, and the two can disagree
  // (backdated or bulk-imported posts), so the last row is not reliably the
  // smallest `_id`. Take the true minimum.
  const nextCursor = minIdCursor(items);
  return { items, nextCursor, stats: { postCount, followerCount, followingCount } };
}

/**
 * Public posts authored by a single user (most recent first), with viewer
 * engagement flags. Used by the public profile page.
 */
export async function listUserPosts(opts: {
  userId: string;
  limit: number;
  before?: string;
  viewerId?: string;
}) {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const query: Record<string, unknown> = {
    authorId: new ObjectId(opts.userId),
    status: 'published',
    visibility: 'public',
  };
  if (opts.before && ObjectId.isValid(opts.before)) {
    query._id = { $lt: new ObjectId(opts.before) };
  }

  const items = await db
    .collection('posts')
    .aggregate([
      { $match: query },
      { $sort: { createdAt: -1, _id: -1 } },
      // Same as listMyPosts: no re-rank, so the `limit * 3` window was dead weight.
      { $limit: limit },
      ...engagementStages(opts.viewerId),
      { $sort: { createdAt: -1, _id: -1 } },
      { $project: POST_PROJECT },
    ])
    .toArray();

  // Sorted by `createdAt`, not `_id`, so the two can disagree (backdated or
  // bulk-imported posts). Take the true minimum rather than the last row.
  const nextCursor = minIdCursor(items);
  return { items, nextCursor };
}

export async function getProvincePostStats(limit = 5): Promise<{ province: string; count: number }[]> {
  const db = getDb();
  const rows = await db
    .collection('posts')
    .aggregate([
      { $match: { status: 'published', 'address.province': { $exists: true, $ne: null } } },
      { $group: { _id: '$address.province', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, province: '$_id', count: 1 } },
    ])
    .toArray();
  return rows as { province: string; count: number }[];
}

/**
 * Compatibility shim for `POST /:id/like`, used by web bundles built before
 * reactions shipped (a client with the feed already open keeps calling it).
 *
 * Any existing reaction — not just 'like' — counts as "liked" for the old UI,
 * so tapping the old button clears whatever reaction the user had. New writes
 * go through reactions.service, so `counts.likes` is never touched again.
 */
export async function toggleLikeCompat(postId: string, userId: string) {
  const db = getDb();
  if (!ObjectId.isValid(postId)) throw new ApiError(400, 'bad_id', 'Invalid post id');

  const existing = await db.collection('reactions').findOne({
    targetType: 'post',
    targetId: new ObjectId(postId),
    userId: new ObjectId(userId),
  });

  if (existing) {
    await removeReaction({ targetType: 'post', targetId: postId, userId });
    return { liked: false };
  }
  await setReaction({ targetType: 'post', targetId: postId, userId, type: 'like' });
  return { liked: true };
}

/**
 * `saves` has a unique index on `{postId, userId}`, so the loser of an insert
 * race gets E11000 rather than a second document. Not transient, so
 * `withTransaction` will not retry it — we translate it into the end state.
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; writeErrors?: { code?: unknown }[] };
  if (e.code === 11000) return true;
  return Array.isArray(e.writeErrors) && e.writeErrors.some((w) => w?.code === 11000);
}

/**
 * Toggle the viewer's save on a post, keeping `counts.saves` exact.
 *
 * The membership change and the counter change are one transaction, and the
 * decision of which way to toggle comes from the write itself (`deletedCount`)
 * rather than from a preceding `findOne`. The old read-then-act version drifted
 * permanently: two concurrent un-saves both saw the save, only one `deleteOne`
 * removed it, but both ran `$inc -1`. A crash between the delete and the `$inc`
 * drifted the same way. `counts.saves` is now read as `saveCount`, so drift is
 * user-visible (it is clamped at `$max: [0, ...]` on read, which stops a legacy
 * negative from rendering, but does not repair the stored value).
 */
export async function toggleSave(postId: string, userId: string) {
  const db = getDb();
  const client = getMongoClient();
  if (!ObjectId.isValid(postId)) throw new ApiError(400, 'bad_id', 'Invalid post id');
  if (!ObjectId.isValid(userId)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  const postOid = new ObjectId(postId);
  const userOid = new ObjectId(userId);

  const post = await db
    .collection('posts')
    .findOne({ _id: postOid }, { projection: { _id: 1 } });
  if (!post) throw new ApiError(404, 'not_found', 'Post not found');

  let saved = false;
  const session: ClientSession = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Atomic: of N concurrent un-saves exactly one gets deletedCount === 1,
      // so exactly one decrement runs. deletedCount === 0 also tells us the
      // post was not saved, which replaces the racy `findOne` probe.
      const del = await db
        .collection('saves')
        .deleteOne({ postId: postOid, userId: userOid }, { session });

      if (del.deletedCount === 1) {
        await db
          .collection('posts')
          .updateOne({ _id: postOid }, { $inc: { 'counts.saves': -1 } }, { session });
        saved = false;
        return;
      }

      await db
        .collection('saves')
        .insertOne({ postId: postOid, userId: userOid, createdAt: new Date() }, { session });
      await db
        .collection('posts')
        .updateOne({ _id: postOid }, { $inc: { 'counts.saves': 1 } }, { session });
      saved = true;
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // Lost a concurrent double-tap: the winner inserted the save and
    // incremented in its own transaction. Ours aborted as a unit, so there is
    // no partial write to undo — just report the state the winner established
    // instead of surfacing a 500.
    saved = true;
  } finally {
    await session.endSession();
  }

  return { saved };
}