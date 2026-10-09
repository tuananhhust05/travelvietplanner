import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { ROLES } from '../auth/rbac.js';

const PAGE_SIZE = 20;

export async function listUsers(opts: { q?: string; role?: string; page?: number }) {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const query: Record<string, unknown> = {};
  if (opts.q) {
    const re = new RegExp(opts.q, 'i');
    query.$or = [{ email: re }, { displayName: re }, { handle: re }];
  }
  if (opts.role) query.roles = opts.role;

  const [items, total] = await Promise.all([
    db
      .collection('users')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .project({ passwordHash: 0, refreshTokens: 0 })
      .toArray(),
    db.collection('users').countDocuments(query),
  ]);
  return {
    items: items.map((u) => ({ id: u._id.toString(), ...u, _id: undefined })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function setUserRole(id: string, role: string) {
  if (!ROLES.includes(role as (typeof ROLES)[number])) {
    throw new ApiError(400, 'bad_role', 'Invalid role');
  }
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  const r = await db.collection('users').updateOne(
    { _id: new ObjectId(id) },
    { $addToSet: { roles: role } },
  );
  if (r.matchedCount === 0) throw new ApiError(404, 'not_found', 'User not found');
}

export async function setUserBanned(id: string, banned: boolean) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  const r = await db.collection('users').updateOne(
    { _id: new ObjectId(id) },
    { $set: { banned, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new ApiError(404, 'not_found', 'User not found');
}

export async function deleteUser(id: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  const r = await db.collection('users').deleteOne({ _id: new ObjectId(id) });
  if (r.deletedCount === 0) throw new ApiError(404, 'not_found', 'User not found');
}

export async function listPosts(opts: { status?: string; page?: number }) {
  const db = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const query: Record<string, unknown> = {};
  if (opts.status) query.status = opts.status;

  const [items, total] = await Promise.all([
    db
      .collection('posts')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    db.collection('posts').countDocuments(query),
  ]);
  return {
    items: items.map((p) => ({ id: p._id.toString(), ...p, _id: undefined })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function setPostStatus(id: string, status: string) {
  const allowed = ['published', 'hidden', 'deleted'];
  if (!allowed.includes(status)) throw new ApiError(400, 'bad_status', 'Invalid status');
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid post id');
  const r = await db.collection('posts').updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new ApiError(404, 'not_found', 'Post not found');
}

export async function setPostFeatured(id: string, featured: boolean) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid post id');
  const r = await db.collection('posts').updateOne(
    { _id: new ObjectId(id) },
    { $set: { featured, updatedAt: new Date() } },
  );
  if (r.matchedCount === 0) throw new ApiError(404, 'not_found', 'Post not found');
}