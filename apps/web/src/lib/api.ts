import type { AuthUser } from './auth';
import type { ReactionCounts, ReactionListItem, ReactionType } from './reactions';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  roles: string[];
}

/** One image or sticker hanging off a comment. Images carry a RELATIVE `/file/...` url. */
export interface CommentAttachment {
  kind: 'image' | 'sticker';
  /** image only: relative `/file/...` path. Never an absolute localhost url. */
  url?: string;
  /** sticker only: namespaced catalogue id, e.g. `travel.plane`. */
  stickerId?: string;
}

export interface BookingItem {
  _id: string;
  fromUserId: string;
  targetUserId: string;
  kind: string;
  refId: string;
  message?: string;
  travelDates?: { from?: string; to?: string };
  pax?: { adults?: number; children?: number };
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  status: string;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

export const NOTIFICATION_TYPES = [
  'post_reaction',
  'comment_reaction',
  'post_comment',
  'comment_reply',
  'follow',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Same shape as a CommentAuthor, kept separate so the two can diverge. */
export interface NotificationActor {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  accountType: string;
}

/**
 * One GROUPED notification row: all activity of one type on one entity collapses
 * into a single row, so twenty reactions on a post read "A and 19 others".
 *
 * `actors` is capped server-side for display; `actorCount` is the real total.
 * Identical on the REST response and the `notification:new` broadcast.
 */
export interface NotificationView {
  _id: string;
  type: NotificationType;
  actors: NotificationActor[];
  actorCount: number;
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Author summary embedded in a CommentView. `null` on a tombstone. */
export interface CommentAuthor {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  accountType: string;
}

/**
 * The comment wire shape (contract part 1 §4.3). Identical on the REST response
 * and the `comment:new` broadcast, except that the broadcast always carries
 * `viewerReaction: null` — it is per-viewer state and is never broadcast.
 */
export type CommentTargetType = 'post' | 'trip';

export interface CommentView {
  _id: string;
  targetType: CommentTargetType;
  targetId: string;
  /** @deprecated wire compat — equals targetId when targetType==='post' */
  postId: string;
  parentId: string | null;
  rootId: string;
  depth: number;
  body: string;
  attachments: CommentAttachment[];
  status: 'visible' | 'deleted';
  createdAt: string;
  editedAt: string | null;
  author: CommentAuthor | null;
  reactions: ReactionCounts;
  reactionsTotal: number;
  viewerReaction: ReactionType | null;
  replyCount: number;
  viewerCanDelete: boolean;
}

/** Body of `POST /v1/posts/:id/comments`. */
export interface CreateCommentInput {
  body?: string;
  parentId?: string | null;
  attachments?: CommentAttachment[];
}

export interface SearchUserResult {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  accountType: string;
  bio?: string;
}

export interface SearchPostResult {
  id: string;
  score: number | null;
  body: string;
  lang: string;
  authorId: string;
  createdAt: string;
  author?: { displayName: string; handle: string; avatarUrl: string | null };
  place?: { name: string; lat?: number; lng?: number } | null;
  address?: { commune: string; province: string; label: string } | null;
}

export interface SearchPlaceResult {
  _id: string;
  slug: string;
  name: string;
  nameEn?: string;
  type: string;
  province: string;
  coverUrl?: string | null;
}

function handle401(): never {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('tvp_token');
    localStorage.removeItem('tvp_refresh');
    localStorage.removeItem('tvp_user');
    window.location.href = '/login';
  }
  throw new Error('Unauthorized');
}

async function req<T>(path: string, opts: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers as Record<string, string>) },
  });
  if (res.status === 401) handle401();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function getToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('tvp_token') ?? undefined;
}

export const api = {
  base: API_URL,
  register: (body: unknown) =>
    req<Session>('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    req<Session>('/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: (token: string) =>
    req<{ user: AuthUser }>('/v1/auth/me', {}, token),
  feed: (limit = 20, before?: string) =>
    req<{ items: unknown[]; nextCursor: string | null }>(
      `/v1/posts/feed?limit=${limit}${before ? `&before=${before}` : ''}`,
      {},
      getToken(),
    ),
  myPosts: (limit = 20, before?: string) =>
    req<{
      items: unknown[];
      nextCursor: string | null;
      stats?: { postCount: number; followerCount: number; followingCount: number };
    }>(
      `/v1/posts/me?limit=${limit}${before ? `&before=${before}` : ''}`,
      {},
      getToken(),
    ),
  createPost: (body: unknown, token: string) =>
    req('/v1/posts', { method: 'POST', body: JSON.stringify(body) }, token),
  getPost: (id: string) =>
    req<unknown>(`/v1/posts/${id}`, {}, getToken()),
  /** @deprecated Kept for compatibility; use setReaction/removeReaction. */
  likePost: (id: string) =>
    req<{ liked: boolean }>(`/v1/posts/${id}/like`, { method: 'POST' }, getToken()),

  // Reactions — server always answers with ABSOLUTE counts, never deltas.
  setReaction: (postId: string, type: ReactionType, token?: string) =>
    req<{ viewerReaction: ReactionType | null; counts: ReactionCounts; total: number }>(
      `/v1/posts/${postId}/reactions`,
      { method: 'PUT', body: JSON.stringify({ type }) },
      token ?? getToken(),
    ),
  removeReaction: (postId: string, token?: string) =>
    req<{ viewerReaction: ReactionType | null; counts: ReactionCounts; total: number }>(
      `/v1/posts/${postId}/reactions`,
      { method: 'DELETE' },
      token ?? getToken(),
    ),
  listReactions: (
    postId: string,
    o: { type?: ReactionType; limit?: number; before?: string } = {},
    token?: string,
  ) => {
    const qs = new URLSearchParams();
    if (o.type) qs.set('type', o.type);
    qs.set('limit', String(o.limit ?? 30));
    if (o.before) qs.set('before', o.before);
    return req<{
      items: ReactionListItem[];
      nextCursor: string | null;
      counts: ReactionCounts;
      total: number;
    }>(`/v1/posts/${postId}/reactions?${qs.toString()}`, {}, token ?? getToken());
  },
  provincePostStats: (limit = 5) =>
    req<{ province: string; count: number }[]>(`/v1/posts/stats/provinces?limit=${limit}`),
  savePost: (id: string) =>
    req<{ saved: boolean }>(`/v1/posts/${id}/save`, { method: 'POST' }, getToken()),

  // Comments — top-level newest first (`before` cursor), replies oldest first
  // (`after` cursor, the inverse comparison of every other list in this API).
  listComments: (
    targetType: CommentTargetType,
    targetId: string,
    o: { limit?: number; before?: string } = {},
    token?: string,
  ) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(o.limit ?? 20));
    if (o.before) qs.set('before', o.before);
    const prefix = targetType === 'trip' ? '/v1/trips' : '/v1/posts';
    return req<{ items: CommentView[]; nextCursor: string | null; total: number }>(
      `${prefix}/${targetId}/comments?${qs.toString()}`,
      {},
      token ?? getToken(),
    );
  },
  listReplies: (
    commentId: string,
    o: { limit?: number; after?: string } = {},
    token?: string,
  ) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(o.limit ?? 10));
    if (o.after) qs.set('after', o.after);
    return req<{ items: CommentView[]; nextCursor: string | null }>(
      `/v1/comments/${commentId}/replies?${qs.toString()}`,
      {},
      token ?? getToken(),
    );
  },
  createComment: (
    targetType: CommentTargetType,
    targetId: string,
    body: CreateCommentInput,
    token?: string,
  ) => {
    const prefix = targetType === 'trip' ? '/v1/trips' : '/v1/posts';
    return req<CommentView>(
      `${prefix}/${targetId}/comments`,
      { method: 'POST', body: JSON.stringify(body) },
      token ?? getToken(),
    );
  },
  updateTripVisibility: (tripId: string, visibility: 'private' | 'public', token?: string) =>
    req<{ ok: true; visibility: string }>(
      `/v1/trips/${tripId}/visibility`,
      { method: 'PATCH', body: JSON.stringify({ visibility }) },
      token ?? getToken(),
    ),
  deleteComment: (commentId: string, token?: string) =>
    req<{ ok: true }>(`/v1/comments/${commentId}`, { method: 'DELETE' }, token ?? getToken()),
  setCommentReaction: (commentId: string, type: ReactionType, token?: string) =>
    req<{ viewerReaction: ReactionType | null; counts: ReactionCounts; total: number }>(
      `/v1/comments/${commentId}/reactions`,
      { method: 'PUT', body: JSON.stringify({ type }) },
      token ?? getToken(),
    ),
  removeCommentReaction: (commentId: string, token?: string) =>
    req<{ viewerReaction: ReactionType | null; counts: ReactionCounts; total: number }>(
      `/v1/comments/${commentId}/reactions`,
      { method: 'DELETE' },
      token ?? getToken(),
    ),
  listCommentReactions: (
    commentId: string,
    o: { type?: ReactionType; limit?: number; before?: string } = {},
    token?: string,
  ) => {
    const qs = new URLSearchParams();
    if (o.type) qs.set('type', o.type);
    qs.set('limit', String(o.limit ?? 30));
    if (o.before) qs.set('before', o.before);
    return req<{
      items: ReactionListItem[];
      nextCursor: string | null;
      counts: ReactionCounts;
      total: number;
    }>(`/v1/comments/${commentId}/reactions?${qs.toString()}`, {}, token ?? getToken());
  },
  updateProfile: (data: unknown, token: string) =>
    req('/v1/auth/me', { method: 'PATCH', body: JSON.stringify(data) }, token),

  // Admin boundary lookups for the province -> commune address picker.
  listProvinces: () => req<{ items: string[] }>('/v1/geo/provinces'),
  listCommunes: (province: string) =>
    req<{ items: string[] }>(`/v1/geo/communes?province=${encodeURIComponent(province)}`),

  // Reverse geocoding against our own admin boundary data.
  resolveAddress: (lat: number, lng: number) =>
    req<{ address: { commune: string; province: string; label: string } | null }>(
      `/v1/geo/resolve?lat=${lat}&lng=${lng}`,
      {},
      getToken(),
    ),

  // Admin
  adminListUsers: (params: { q?: string; role?: string; page?: number }) =>
    req<{ items: unknown[]; total: number; page: number; pageSize: number }>(
      `/v1/admin/users?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
      )}`,
      {},
      getToken(),
    ),
  adminSetUserRole: (id: string, role: string) =>
    req(`/v1/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }, getToken()),
  adminSetUserBan: (id: string, banned: boolean) =>
    req(`/v1/admin/users/${id}/ban`, { method: 'PATCH', body: JSON.stringify({ banned }) }, getToken()),
  adminDeleteUser: (id: string) =>
    req(`/v1/admin/users/${id}`, { method: 'DELETE' }, getToken()),
  adminListPosts: (params: { status?: string; page?: number }) =>
    req<{ items: unknown[]; total: number; page: number; pageSize: number }>(
      `/v1/admin/posts?${new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
      )}`,
      {},
      getToken(),
    ),
  adminSetPostStatus: (id: string, status: string) =>
    req(`/v1/admin/posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, getToken()),
  adminSetPostFeatured: (id: string, featured: boolean) =>
    req(`/v1/admin/posts/${id}/feature`, { method: 'PATCH', body: JSON.stringify({ featured }) }, getToken()),

  // Knowledge base
  kbListDocuments: () =>
    req<{ items: unknown[] }>('/v1/kb/documents', {}, getToken()),
  kbUploadDocument: (formData: FormData) =>
    req('/v1/kb/documents', {
      method: 'POST',
      body: formData,
      headers: { 'content-type': undefined } as unknown as Record<string, string>,
    }, getToken()),
  kbProcessDocument: (id: string) =>
    req<{ chunks: number }>(`/v1/kb/documents/${id}/process`, { method: 'POST' }, getToken()),
  kbDeleteDocument: (id: string) =>
    req(`/v1/kb/documents/${id}`, { method: 'DELETE' }, getToken()),
  kbSetPublished: (id: string, published: boolean) =>
    req(`/v1/kb/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ published }) }, getToken()),

  // Services (guide tours)
  listServices: () => req<{ items: unknown[] }>('/v1/services', {}, getToken()),
  // Public discovery — no auth needed
  exploreServices: (params?: { guideId?: string; category?: string; q?: string; limit?: number }) =>
    req<{ items: unknown[] }>(
      `/v1/services/explore${params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][])}` : ''}`,
      {},
    ),
  getPublicService: (id: string) =>
    req(`/v1/services/${id}`, {}),
  getService: (id: string) => req(`/v1/services/${id}`, {}, getToken()),
  createService: (body: unknown) =>
    req('/v1/services', { method: 'POST', body: JSON.stringify(body) }, getToken()),
  updateService: (id: string, body: unknown) =>
    req(`/v1/services/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, getToken()),
  deleteService: (id: string) =>
    req(`/v1/services/${id}`, { method: 'DELETE' }, getToken()),
  trackServiceView: (id: string) =>
    req(`/v1/services/${id}/view`, { method: 'POST' }, getToken()),
  getServiceViewers: (id: string) =>
    req<{ viewers: { userId: string; displayName: string; handle: string | null; avatarUrl: string | null; viewedAt: string }[] }>(`/v1/services/${id}/viewers`, {}, getToken()),

  // Listings
  listListings: () =>
    req<{ items: unknown[] }>('/v1/listings', {}, getToken()),
  getListing: (id: string) =>
    req(`/v1/listings/${id}`, {}, getToken()),
  createListing: (body: Record<string, unknown>) =>
    req('/v1/listings', { method: 'POST', body: JSON.stringify(body) }, getToken()),
  updateListing: (id: string, body: Record<string, unknown>) =>
    req(`/v1/listings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, getToken()),
  deleteListing: (id: string) =>
    req(`/v1/listings/${id}`, { method: 'DELETE' }, getToken()),

  // Bookings (guide inquiries)
  listBookings: (status?: string) =>
    req<{ items: unknown[] }>(`/v1/bookings${status && status !== 'all' ? `?status=${status}` : ''}`, {}, getToken()),
  createBooking: (body: { serviceId: string; travelDate?: string; pax?: number; note?: string; contact?: { name?: string; phone?: string; email?: string } }) =>
    req('/v1/bookings', { method: 'POST', body: JSON.stringify(body) }, getToken()),
  getBooking: (id: string) => req<unknown>(`/v1/bookings/${id}`, {}, getToken()),
  updateBookingStatus: (id: string, status: string) =>
    req(`/v1/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, getToken()),
  getMyBookings: (serviceId?: string) => {
    const url = serviceId ? `/v1/bookings/mine?serviceId=${serviceId}` : '/v1/bookings/mine';
    return req<{ items: BookingItem[] }>(url, {}, getToken());
  },
  updateBooking: (id: string, body: {
    travelDate?: string;
    pax?: number;
    note?: string;
    contact?: { name?: string; phone?: string; email?: string };
  }) =>
    req(`/v1/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }, getToken()),

  // Messages
  listConversations: () => req<{ items: unknown[] }>('/v1/conversations', {}, getToken()),
  getConversation: (id: string) => req(`/v1/conversations/${id}`, {}, getToken()),
  listMessages: (id: string) => req<{ items: unknown[] }>(`/v1/conversations/${id}/messages`, {}, getToken()),
  sendMessage: (
    id: string,
    body: string,
    opts: { type?: 'text' | 'image' | 'file' | 'link'; attachments?: unknown[]; linkPreview?: unknown } = {},
  ) =>
    req<{
      _id: string;
      conversationId: string;
      senderId: string;
      body: string;
      type: string;
      attachments: unknown[];
      linkPreview: unknown;
      seq: number;
      createdAt: string;
    }>(
      `/v1/conversations/${id}/messages`,
      { method: 'POST', body: JSON.stringify({ body, ...opts }) },
      getToken(),
    ),
  getLinkPreview: (url: string) =>
    req<{ url: string; title: string; description?: string; image?: string | null }>(
      `/v1/conversations/link-preview?url=${encodeURIComponent(url)}`,
      {},
      getToken(),
    ),
  createConversation: (otherUserId: string) =>
    req<{ _id: string }>('/v1/conversations', { method: 'POST', body: JSON.stringify({ otherUserId }) }, getToken()),

  // Follow suggestions
  suggestions: (limit = 5) =>
    req<{ items: unknown[] }>(`/v1/users/suggestions?limit=${limit}`, {}, getToken()),
  follow: (id: string) =>
    req<{ following: boolean }>(`/v1/users/${id}/follow`, { method: 'POST' }, getToken()),
  unfollow: (id: string) =>
    req<{ following: boolean }>(`/v1/users/${id}/follow`, { method: 'DELETE' }, getToken()),

  // User search + public profiles
  search: (q: string, tab: 'all' | 'posts' | 'users' | 'places', limit = 20) => {
    const qs = new URLSearchParams({ q, tab, limit: String(limit) });
    return req<{
      users: SearchUserResult[];
      posts: SearchPostResult[];
      places: SearchPlaceResult[];
    }>(`/v1/search?${qs.toString()}`, {}, getToken());
  },
  searchUsers: (q: string, limit = 10) =>
    req<{ items: unknown[] }>(
      `/v1/users/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      {},
      getToken(),
    ),
  searchPosts: (q: string, limit = 20) =>
    req<{ items: SearchPostResult[]; total: number }>(
      `/v1/search?q=${encodeURIComponent(q)}&type=posts&limit=${limit}`,
      {},
      getToken(),
    ),
  searchPlaces: (q: string, limit = 10) =>
    req<{ items: SearchPlaceResult[] }>(
      `/v1/search/places?q=${encodeURIComponent(q)}&limit=${limit}`,
      {},
      getToken(),
    ),
  searchAll: (q: string) =>
    req<{ posts: SearchPostResult[]; users: SearchUserResult[]; places: SearchPlaceResult[] }>(
      `/v1/search/all?q=${encodeURIComponent(q)}`,
      {},
      getToken(),
    ),
  getUserProfile: (handle: string) =>
    req<{ user: unknown; stats: unknown; viewerFollowing: boolean; isSelf: boolean }>(
      `/v1/users/${encodeURIComponent(handle)}`,
      {},
      getToken(),
    ),
  getUserPosts: (handle: string, limit = 20, before?: string) =>
    req<{ items: unknown[]; nextCursor: string | null }>(
      `/v1/users/${encodeURIComponent(handle)}/posts?limit=${limit}${
        before ? `&before=${before}` : ''
      }`,
      {},
      getToken(),
    ),

  // Notifications. Every row is GROUPED server-side by (type, entity), so one row
  // can carry several actors and `actorCount` is the true total — `actors.length`
  // is capped for display and must never be used as the count.
  listNotifications: (
    o: { limit?: number; before?: string; unreadOnly?: boolean } = {},
    token?: string,
  ) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(o.limit ?? 20));
    if (o.before) qs.set('before', o.before);
    if (o.unreadOnly) qs.set('filter', 'unread');
    return req<{
      items: NotificationView[];
      nextCursor: string | null;
      unreadCount: number;
    }>(`/v1/notifications?${qs.toString()}`, {}, token ?? getToken());
  },
  /** Badge only — deliberately cheaper than fetching a page to count it. */
  notificationUnreadCount: (token?: string) =>
    req<{ unreadCount: number }>('/v1/notifications/unread-count', {}, token ?? getToken()),
  markNotificationRead: (id: string, token?: string) =>
    req<{ ok: true; unreadCount: number }>(
      `/v1/notifications/${id}/read`,
      { method: 'POST' },
      token ?? getToken(),
    ),
  markAllNotificationsRead: (token?: string) =>
    req<{ ok: true; unreadCount: number }>(
      '/v1/notifications/read-all',
      { method: 'POST' },
      token ?? getToken(),
    ),

  uploadFile: async (
    file: File,
    token: string,
  ): Promise<{ url: string; name: string; size: number; mimeType: string }> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/v1/uploads`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    if (res.status === 401) handle401();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<{ url: string; name: string; size: number; mimeType: string }>;
  },
};
