import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';

export type BookingStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'spam';

export async function listBookings(guideId: string, status?: string) {
  const db = getDb();
  const query: Record<string, unknown> = { targetUserId: new ObjectId(guideId) };
  if (status && status !== 'all') query.status = status;
  const items = await db
    .collection('inquiries')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
  return { items };
}

export async function updateBookingStatus(id: string, guideId: string, status: BookingStatus) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid booking id');
  const r = await db.collection('inquiries').findOneAndUpdate(
    { _id: new ObjectId(id), targetUserId: new ObjectId(guideId) },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Booking not found');
  return r;
}

/**
 * Fetch one inquiry for its detail view. Either side of the inquiry may read it:
 * the guide it targets or the traveler who sent it. The viewer's side is
 * returned so the client knows which actions to offer.
 */
export async function getBooking(id: string, userId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid booking id');
  const uid = new ObjectId(userId);
  const booking = await db.collection('inquiries').findOne({
    _id: new ObjectId(id),
    $or: [{ targetUserId: uid }, { fromUserId: uid }],
  });
  if (!booking) throw new ApiError(404, 'not_found', 'Booking not found');

  const viewerRole = booking.targetUserId?.equals(uid) ? 'guide' : 'traveler';
  // The counterparty is whoever the viewer is not.
  const counterpartyId = viewerRole === 'guide' ? booking.fromUserId : booking.targetUserId;

  const [service, counterparty] = await Promise.all([
    booking.refId
      ? db.collection('services').findOne(
          { _id: booking.refId },
          { projection: { title: 1, coverImage: 1, price: 1, duration: 1, location: 1, category: 1 } },
        )
      : null,
    counterpartyId
      ? db.collection('users').findOne(
          { _id: counterpartyId },
          { projection: { displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 } },
        )
      : null,
  ]);

  return { ...booking, viewerRole, service, counterparty };
}

export interface CreateBookingInput {
  fromUserId: string;
  serviceId: string;
  travelDate?: string;
  pax?: number;
  note?: string;
  contact?: { name?: string; phone?: string; email?: string };
}

/** A traveler books a tour → creates an inquiry for the guide. */
export async function createBooking(input: CreateBookingInput) {
  const db = getDb();
  if (!ObjectId.isValid(input.serviceId)) throw new ApiError(400, 'bad_id', 'Invalid service id');
  const service = await db.collection('services').findOne({
    _id: new ObjectId(input.serviceId),
    deletedAt: null,
    status: 'active',
  });
  if (!service) throw new ApiError(404, 'not_found', 'Service not found');

  const now = new Date();
  const travelDate = input.travelDate ? new Date(input.travelDate) : null;
  const inquiry = {
    targetUserId: service.guideId,
    fromUserId: new ObjectId(input.fromUserId),
    kind: 'tour',
    refId: new ObjectId(input.serviceId),
    message: input.note ?? '',
    travelDates: travelDate ? { from: travelDate, to: travelDate } : null,
    pax: { adults: input.pax ?? 1, children: 0 },
    contact: input.contact ?? {},
    status: 'new' as BookingStatus,
    source: 'service',
    createdAt: now,
    updatedAt: now,
  };
  const r = await db.collection('inquiries').insertOne(inquiry);

  // Bump the tour's inquiry counter so guides see engagement.
  await db.collection('services').updateOne(
    { _id: new ObjectId(input.serviceId) },
    { $inc: { 'counters.inquiries': 1 } },
  );

  return { id: r.insertedId.toString(), ...inquiry };
}

// Query bookings theo fromUserId (traveler view), filter theo refId nếu có serviceId
export async function listMyBookings(travelerId: string, serviceId?: string) {
  const db = getDb();
  const query: Record<string, unknown> = { fromUserId: new ObjectId(travelerId) };
  if (serviceId && ObjectId.isValid(serviceId)) query.refId = new ObjectId(serviceId);
  const items = await db.collection('inquiries').find(query).sort({ createdAt: -1 }).toArray();
  return { items };
}

// Update booking - chỉ cho phép khi fromUserId match và status là new/contacted
export async function updateBooking(
  id: string,
  travelerId: string,
  data: { travelDate?: string; pax?: number; note?: string; contact?: { name?: string; phone?: string; email?: string } }
) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid booking id');
  const booking = await db.collection('inquiries').findOne({
    _id: new ObjectId(id),
    fromUserId: new ObjectId(travelerId),
  });
  if (!booking) throw new ApiError(404, 'not_found', 'Booking not found');
  if (!['new', 'contacted'].includes(booking.status)) {
    throw new ApiError(400, 'not_editable', 'Booking cannot be edited in current status');
  }
  const now = new Date();
  const travelDate = data.travelDate ? new Date(data.travelDate) : undefined;
  const updateFields: Record<string, unknown> = { updatedAt: now };
  if (travelDate !== undefined) updateFields.travelDates = { from: travelDate, to: travelDate };
  if (data.pax !== undefined) updateFields['pax.adults'] = data.pax;
  if (data.note !== undefined) updateFields.message = data.note;
  if (data.contact !== undefined) updateFields.contact = data.contact;
  const r = await db.collection('inquiries').findOneAndUpdate(
    { _id: new ObjectId(id), fromUserId: new ObjectId(travelerId) },
    { $set: updateFields },
    { returnDocument: 'after' },
  );
  if (!r) throw new ApiError(404, 'not_found', 'Booking not found');
  return r;
}