import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { notify } from '../notifications/notifications.service.js';

/**
 * Suggest users to follow: those with the most published posts, excluding
 * the viewer and anyone the viewer already follows.
 */
export async function listSuggestions(opts: { viewerId: string; limit: number }) {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit, 1), 20);
  const viewerId = new ObjectId(opts.viewerId);

  const followed = await db
    .collection('follows')
    .find({ followerId: viewerId })
    .project({ followeeId: 1, _id: 0 })
    .toArray();
  const followedIds = followed.map((f) => f.followeeId);

  const items = await db
    .collection('posts')
    .aggregate([
      { $match: { status: 'published', visibility: 'public' } },
      { $group: { _id: '$authorId', postCount: { $sum: 1 } } },
      { $sort: { postCount: -1 } },
      { $limit: limit * 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'user._id': { $ne: viewerId, $nin: followedIds },
          'user.status': 'active',
        },
      },
      { $limit: limit },
      {
        $project: {
          _id: '$user._id',
          displayName: '$user.displayName',
          handle: '$user.handle',
          avatarUrl: '$user.avatarUrl',
          accountType: '$user.accountType',
          postCount: 1,
        },
      },
    ])
    .toArray();

  return { items };
}

/**
 * Search active users by display name or email (case-insensitive), excluding
 * the viewer. Used by the messages page to start a new conversation.
 */
export async function searchUsers(opts: { q: string; viewerId: string; limit: number }) {
  const db = getDb();
  const q = opts.q.trim();
  const limit = Math.min(Math.max(opts.limit, 1), 20);
  if (!q) return { items: [] };

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  const items = await db
    .collection('users')
    .find({
      _id: { $ne: new ObjectId(opts.viewerId) },
      status: 'active',
      $or: [{ displayName: regex }, { handle: regex }, { email: regex }],
    })
    .project({ _id: 1, displayName: 1, handle: 1, avatarUrl: 1, accountType: 1, bio: 1 })
    .limit(limit)
    .toArray();

  return { items };
}

/**
 * Public profile lookup by handle (or _id fallback), plus follower stats and
 * the viewer's follow state so a profile page can render in one call.
 */
export async function getUserProfile(opts: { handle: string; viewerId?: string }) {
  const db = getDb();
  const handle = opts.handle.toLowerCase().trim();
  const conditions: Record<string, unknown>[] = [{ handle }];
  if (ObjectId.isValid(handle)) conditions.push({ _id: new ObjectId(handle) });

  const user = await db.collection('users').findOne({ $or: conditions, status: 'active' });
  if (!user) throw new ApiError(404, 'not_found', 'User not found');

  const userId = user._id;
  const [postCount, followerCount, followingCount, viewerFollowing] = await Promise.all([
    db
      .collection('posts')
      .countDocuments({ authorId: userId, status: 'published', visibility: 'public' }),
    db.collection('follows').countDocuments({ followeeId: userId }),
    db.collection('follows').countDocuments({ followerId: userId }),
    opts.viewerId
      ? db
          .collection('follows')
          .countDocuments({ followerId: new ObjectId(opts.viewerId), followeeId: userId })
      : 0,
  ]);

  return {
    user: {
      _id: userId.toString(),
      displayName: user.displayName,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      accountType: user.accountType,
      bio: user.bio,
    },
    stats: { postCount, followerCount, followingCount },
    viewerFollowing: viewerFollowing > 0,
    isSelf: opts.viewerId ? opts.viewerId === userId.toString() : false,
  };
}

export async function toggleFollow(followerId: string, followeeId: string) {
  const db = getDb();
  if (!ObjectId.isValid(followeeId)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  if (followerId === followeeId) throw new ApiError(400, 'cannot_follow_self', 'Cannot follow yourself');

  const followee = await db.collection('users').findOne({ _id: new ObjectId(followeeId) });
  if (!followee) throw new ApiError(404, 'not_found', 'User not found');

  const existing = await db.collection('follows').findOne({
    followerId: new ObjectId(followerId),
    followeeId: new ObjectId(followeeId),
  });
  if (existing) {
    await db.collection('follows').deleteOne({ _id: existing._id });
    return { following: false };
  }
  await db.collection('follows').insertOne({
    followerId: new ObjectId(followerId),
    followeeId: new ObjectId(followeeId),
    createdAt: new Date(),
  });

  // Only the follow direction notifies — an unfollow is not an event anybody wants
  // in their bell. `entityId` is the FOLLOWER, not the recipient, so each follower
  // owns one row: a follow/unfollow/re-follow cycle bumps that row instead of
  // stacking duplicates, and the count cannot creep upward forever the way a single
  // per-recipient row would.
  await notify({
    userId: new ObjectId(followeeId),
    actorId: new ObjectId(followerId),
    type: 'follow',
    entityId: new ObjectId(followerId),
  });
  return { following: true };
}