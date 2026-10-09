import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { EMPTY_COUNTS } from '../posts/reactions.service.js';

export interface ServiceInput {
  title: string;
  description?: string;
  category?: string;
  price?: number;
  duration?: string;
  location?: string;
  maxPax?: number;
  coverImage?: string;
  images?: string[];
  video?: string;
  status?: 'active' | 'paused';
}

export async function listServices(guideId: string) {
  const db = getDb();
  const items = await db
    .collection('services')
    .find({ guideId: new ObjectId(guideId), deletedAt: null })
    .sort({ createdAt: -1 })
    .toArray();
  return { items };
}

export async function getService(id: string, guideId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid service id');
  const service = await db.collection('services').findOne({
    _id: new ObjectId(id),
    guideId: new ObjectId(guideId),
    deletedAt: null,
  });
  if (!service) throw new ApiError(404, 'not_found', 'Service not found');
  return service;
}

/** Attach the guide's public profile so clients can see who runs the tour. */
async function attachGuide(service: any) {
  const db = getDb();
  const guide = await db
    .collection('users')
    .findOne(
      { _id: service.guideId },
      { projection: { displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 } },
    );
  return {
    ...service,
    guide: guide
      ? {
          _id: guide._id.toString(),
          displayName: guide.displayName,
          handle: guide.handle,
          avatarUrl: guide.avatarUrl,
        }
      : null,
  };
}

/** Public single-service view. Active and paused services are both visible to
 *  the public (so travellers see the tour info and the "paused" notice), but
 *  deleted services return 404.  The edit page can fetch any non-deleted
 *  service regardless of status because the owner check is handled upstream. */
export async function getPublicService(id: string, viewerId?: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid service id');
  const service = await db
    .collection('services')
    .findOne({ _id: new ObjectId(id), deletedAt: null });
  if (!service) throw new ApiError(404, 'not_found', 'Service not found');
  return attachGuide(service);
}

/** Public discovery list — active services, optional guide/category/keyword filters. */
export async function listPublicServices(opts: {
  guideId?: string;
  category?: string;
  q?: string;
  limit?: number;
}) {
  const db = getDb();
  const query: Record<string, unknown> = { status: 'active', deletedAt: null };
  if (opts.guideId) query.guideId = new ObjectId(opts.guideId);
  if (opts.category) query.category = opts.category;
  if (opts.q) query.title = { $regex: opts.q, $options: 'i' };
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const services = await db
    .collection('services')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  const items = await Promise.all(services.map(attachGuide));
  return { items };
}

export async function incrementInquiryCount(serviceId: string) {
  const db = getDb();
  await db.collection('services').updateOne(
    { _id: new ObjectId(serviceId) },
    { $inc: { 'counters.inquiries': 1 } },
  );
}

/** Record a view from a logged-in user. Each user is counted only once (unique viewers).
 *  Also used when a user views a feed post that belongs to this service. */
export async function trackServiceView(serviceId: string, userId: string) {
  const db = getDb();
  if (!ObjectId.isValid(serviceId) || !ObjectId.isValid(userId)) return;
  const svcOid = new ObjectId(serviceId);
  const userOid = new ObjectId(userId);

  // Upsert — if this user already viewed, do nothing
  const result = await db.collection('service_views').updateOne(
    { serviceId: svcOid, userId: userOid },
    { $setOnInsert: { serviceId: svcOid, userId: userOid, viewedAt: new Date() } },
    { upsert: true },
  );

  // Only update the counter when a new document was inserted (new unique viewer)
  if (result.upsertedCount > 0) {
    await db.collection('services').updateOne(
      { _id: svcOid },
      { $inc: { 'counters.views': 1 } },
    );
  }
}

/** Return list of users who viewed a service — only the owner may call this. */
export async function getServiceViewers(serviceId: string, requesterId: string) {
  const db = getDb();
  if (!ObjectId.isValid(serviceId)) throw new ApiError(400, 'bad_id', 'Invalid service id');

  const service = await db.collection('services').findOne(
    { _id: new ObjectId(serviceId), deletedAt: null },
    { projection: { guideId: 1 } },
  );
  if (!service) throw new ApiError(404, 'not_found', 'Service not found');
  if (service.guideId.toString() !== requesterId) throw new ApiError(403, 'forbidden', 'Forbidden');

  const views = await db
    .collection('service_views')
    .find({ serviceId: new ObjectId(serviceId) })
    .sort({ viewedAt: -1 })
    .toArray();

  if (views.length === 0) return { viewers: [] };

  const userIds = views.map((v) => v.userId);
  const users = await db
    .collection('users')
    .find(
      { _id: { $in: userIds } },
      { projection: { displayName: 1, handle: 1, avatarUrl: 1 } },
    )
    .toArray();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const viewers = views.map((v) => {
    const u = userMap.get(v.userId.toString());
    return {
      userId: v.userId.toString(),
      displayName: u?.displayName ?? 'Người dùng',
      handle: u?.handle ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      viewedAt: v.viewedAt,
    };
  });

  return { viewers };
}

export async function createService(guideId: string, input: ServiceInput) {
  const db = getDb();
  const now = new Date();
  const service = {
    guideId: new ObjectId(guideId),
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? 'tour',
    price: input.price ?? 0,
    currency: 'VND',
    duration: input.duration ?? '',
    location: input.location ?? '',
    maxPax: input.maxPax ?? 1,
    coverImage: input.coverImage ?? '',
    images: input.images ?? [],
    video: input.video ?? '',
    status: input.status ?? 'active',
    counters: { views: 0, inquiries: 0 },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const r = await db.collection('services').insertOne(service);
  const serviceId = r.insertedId;

  // Auto-create a feed post so the tour appears on /feed. Cover image first,
  // then gallery images, then the video — so the most representative media leads.
  const bodyParts = [input.title];
  if (input.description) bodyParts.push(input.description);
  if (input.location) bodyParts.push(`📍 ${input.location}`);
  const media: { url: string; type: 'image' | 'video' }[] = [];
  if (input.coverImage) media.push({ url: input.coverImage, type: 'image' });
  for (const url of input.images ?? []) media.push({ url, type: 'image' });
  if (input.video) media.push({ url: input.video, type: 'video' });
  await db.collection('posts').insertOne({
    authorId: new ObjectId(guideId),
    body: bodyParts.join('\n\n'),
    lang: 'vi',
    media,
    placeId: null,
    place: null,
    address: null,
    visibility: 'public',
    status: 'published',
    serviceId,
    counts: {
      reactions: { ...EMPTY_COUNTS },
      reactionsTotal: 0,
      comments: 0,
      saves: 0,
    },
    createdAt: now,
    updatedAt: now,
  });

  return { id: serviceId.toString(), ...service };
}

export async function updateService(id: string, guideId: string, input: Partial<ServiceInput>) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid service id');
  const update: Record<string, unknown> = { updatedAt: new Date() };
  const allowed: (keyof ServiceInput)[] = [
    'title', 'description', 'category', 'price', 'duration',
    'location', 'maxPax', 'coverImage', 'images', 'video', 'status',
  ];
  for (const key of allowed) {
    if (input[key] !== undefined) update[key] = input[key];
  }
  const r = await db.collection('services').findOneAndUpdate(
    { _id: new ObjectId(id), guideId: new ObjectId(guideId), deletedAt: null },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Service not found');
  return r;
}

export async function deleteService(id: string, guideId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid service id');
  const r = await db.collection('services').findOneAndUpdate(
    { _id: new ObjectId(id), guideId: new ObjectId(guideId), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Service not found');
  return { id };
}