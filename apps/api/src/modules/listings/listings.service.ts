import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { EMPTY_COUNTS } from '../posts/reactions.service.js';

export interface ListingInput {
  title: string;
  description?: string;
  category?: string;
  type?: string;
  price?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  images?: string[];
  location?: string;
  status?: 'active' | 'paused';
}

export async function listListings(ownerId: string) {
  const db = getDb();
  const items = await db
    .collection('listings')
    .find({ ownerId: new ObjectId(ownerId), deletedAt: null })
    .sort({ createdAt: -1 })
    .toArray();
  return { items };
}

export async function getListing(id: string, ownerId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid listing id');
  const listing = await db.collection('listings').findOne({
    _id: new ObjectId(id),
    ownerId: new ObjectId(ownerId),
    deletedAt: null,
  });
  if (!listing) throw new ApiError(404, 'not_found', 'Listing not found');
  return listing;
}

export async function createListing(ownerId: string, input: ListingInput) {
  const db = getDb();
  const now = new Date();
  const listing = {
    ownerId: new ObjectId(ownerId),
    title: input.title,
    description: input.description ?? '',
    category: input.category ?? 'hotel',
    type: input.type ?? '',
    price: input.price ?? 0,
    currency: 'VND',
    location: input.location ?? '',
    phone: input.phone ?? '',
    website: input.website ?? '',
    openingHours: input.openingHours ?? '',
    images: input.images ?? [],
    status: input.status ?? 'active',
    counters: { views: 0, inquiries: 0 },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const r = await db.collection('listings').insertOne(listing);
  const listingId = r.insertedId;

  const bodyParts = [input.title];
  if (input.description) bodyParts.push(input.description);
  if (input.location) bodyParts.push(`📍 ${input.location}`);
  const media = (input.images ?? []).map((url) => ({ url, type: 'image' as const }));
  await db.collection('posts').insertOne({
    authorId: new ObjectId(ownerId),
    body: bodyParts.join('\n\n'),
    lang: 'vi',
    media,
    placeId: null,
    place: null,
    address: null,
    visibility: 'public',
    status: 'published',
    listingId,
    counts: { reactions: { ...EMPTY_COUNTS }, reactionsTotal: 0, comments: 0, saves: 0 },
    createdAt: now,
    updatedAt: now,
  });

  return { id: listingId.toString(), ...listing };
}

export async function updateListing(id: string, ownerId: string, input: Partial<ListingInput>) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid listing id');
  const update: Record<string, unknown> = { updatedAt: new Date() };
  const allowed: (keyof ListingInput)[] = [
    'title', 'description', 'category', 'type', 'price',
    'phone', 'website', 'openingHours', 'images', 'location', 'status',
  ];
  for (const key of allowed) {
    if (input[key] !== undefined) update[key] = input[key];
  }
  const r = await db.collection('listings').findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: new ObjectId(ownerId), deletedAt: null },
    { $set: update },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Listing not found');
  return r;
}

export async function deleteListing(id: string, ownerId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid listing id');
  const r = await db.collection('listings').findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: new ObjectId(ownerId), deletedAt: null },
    { $set: { deletedAt: new Date(), updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Listing not found');
  return { id };
}
