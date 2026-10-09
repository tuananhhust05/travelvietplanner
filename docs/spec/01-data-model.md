# SPEC-01 — Mô hình dữ liệu (MongoDB)

Nguồn sự thật duy nhất. Quy ước: `_id` là ObjectId; timestamp UTC (`createdAt`, `updatedAt`); xoá mềm bằng `deletedAt`; tiền tệ lưu số nguyên VND (không dùng float); trường đa ngôn ngữ dạng `{ vi: String, en: String }`.

## 0. Sơ đồ quan hệ (ERD tổng quan)

MongoDB không có khoá ngoại cứng; quan hệ dưới đây là "FK ảo" (tham chiếu bằng ObjectId) mà tầng ứng dụng phải giữ toàn vẹn. Ký hiệu: `1—*` một-nhiều, `*—*` nhiều-nhiều (qua collection nối), `1—1` một-một.

```
                              ┌─────────────┐
                    owns 1—*  │   users     │ *—* follows (self, qua follows)
              ┌───────────────┤  (danh tính)├──────────────┐
              │               └──────┬──────┘              │
              │ 1—*                  │ 1—*                 │ 1—*
       ┌──────▼──────┐        ┌──────▼──────┐       ┌──────▼───────┐
       │organizations│        │    posts    │       │ collections  │
       │ (agency/biz)│        │ (bài viết)  │       │ (bộ sưu tập) │
       └──┬───────┬──┘        └──┬───────┬──┘       └──────┬───────┘
    1—*   │       │ 1—*    1—*   │       │ 1—*             │ 1—*
  ┌───────▼─┐ ┌───▼──────┐ ┌─────▼────┐ ┌▼──────────┐ ┌────▼──────────┐
  │  tours  │ │ listings │ │ comments │ │ reactions │ │collectionItems│
  └────┬────┘ └────┬─────┘ └──────────┘ └───────────┘ └───────┬───────┘
       │           │                                          │ ref→
       │ ref       │ ref                                      │ post/place/
       └─────┬─────┘                                          │ tour/listing/
             │                                                │ itinerary
       ┌─────▼─────┐   memberships (users *—* organizations, role owner/manager/staff)
       │  places   │◄──────────────── serviceAreas / destinations / placeId
       │ (địa danh)│◄── ancestors (self 1—*, materialized path)
       └───────────┘

   users 1—* plannerConversations 1—* plannerMessages ─cite→ kbChunks / web / platform
   users 1—* itineraries (source=planner|manual) ─items ref→ places/orgs/listings/tours
   users *—* conversations (participants[]) 1—* messages
   kbDocuments 1—* kbChunks ──vectorId 1—1→ Qdrant point
   posts/places/orgs/tours/listings ──outbox 1—1→ Elasticsearch document (phái sinh)
```

Quan hệ chính cần chú ý toàn vẹn:
- `posts.author` là polymorphic (`user` hoặc `org`); khi org bị xoá, post dưới danh nghĩa org phải được xử lý (ẩn hoặc chuyển chủ).
- `places.parentId`/`ancestors` là self-reference; ràng buộc: `parentId` phải trỏ tới place có `type` ở cấp cao hơn (province > district > ward > POI).
- `collectionItems.targetId` là polymorphic theo `targetKind`; khi đích bị xoá → dọn item mồ côi (xem §14).
- `kbChunks.vectorId` là cầu 1—1 sang Qdrant; MongoDB là nguồn để rebuild.

## 1. users

```js
{
  _id, handle,                        // handle: unique, [a-z0-9_.]{3,30}
  email, emailVerifiedAt,
  phone: { e164, verifiedAt },        // e164 mã hoá field-level
  password: { hash, algo: 'argon2id', updatedAt },
  accountType: 'traveler'|'agency'|'business'|'guide',
  profile: {
    displayName, avatarUrl, coverUrl, bio,
    dob, gender, country, city,
    languages: ['vi','en'],
    interests: ['beach','food','culture',...],
    wishlistPlaces: [ObjectId]
  },
  guideProfile: {                     // chỉ khi accountType='guide'
    licenseNo, licenseImageKey, licenseExpiry,
    languages: [{ code, level }], regions: [ObjectId],
    specialties: [String], yearsExperience,
    dayRate: { amount, currency: 'VND' },
    verifiedStatus: 'unverified'|'pending'|'verified'|'rejected'|'suspended',
    rating: { avg, count }
  },
  locale: 'vi'|'en', timezone: 'Asia/Ho_Chi_Minh',
  mfa: { enabled, secret /*encrypted*/, backupCodes: [hash], enrolledAt },
  oauth: [{ provider: 'google', sub, linkedAt }],
  platformRoles: ['moderator'|'kb_editor'|'admin'|'super_admin'],
  roleGrants: [{ role, grantedBy, grantedAt, expiresAt, reason }],
  trustScore: Number,                 // 0..100, default 50
  counters: { posts, followers, following },
  privacy: { profileVisibility: 'public'|'followers', allowMessageFrom: 'everyone'|'following'|'nobody',
             showWishlist: Boolean },
  notificationPrefs: { <type>: { inApp, push, email } },
  status: 'active'|'restricted'|'suspended'|'deleted',
  restrictions: [{ feature, until, reason, actorId }],
  security: { lastLoginAt, lastLoginIp, failedAttempts, lockedUntil, passwordChangedAt },
  consents: [{ type: 'tos'|'privacy'|'marketing'|'analytics', version, grantedAt, ip }],
  deletionRequestedAt, createdAt, updatedAt, deletedAt
}
```

Index: `{email:1}` unique · `{handle:1}` unique · `{'phone.e164':1}` sparse · `{accountType:1,status:1}` · `{'guideProfile.verifiedStatus':1,'guideProfile.regions':1}` · `{createdAt:-1}`.

## 2. organizations

```js
{
  _id, type: 'agency'|'business', slug,          // slug unique
  name, legalName, businessType,                 // hotel|homestay|restaurant|transport|activity|other
  description: { vi, en },
  taxCode, licenseNo,
  documents: [{ kind: 'business_license'|'tour_license'|'food_safety'|'other',
                fileKey, uploadedAt, ocrData, status }],
  contact: { email, phone, website, hotline },
  location: { address, ward, district, province, placeId,
              geo: { type: 'Point', coordinates: [lng, lat] } },
  serviceAreas: [ObjectId],                      // -> places
  specialties: [String],
  media: { logoUrl, coverUrl, gallery: [{ key, caption }] },
  openingHours: [{ dayOfWeek, open, close, closed }],
  priceRange: { min, max, currency: 'VND' },
  verification: { status, submittedAt, reviewedAt, reviewerId, rejectionReason, verifiedAt },
  rating: { avg, count },
  counters: { posts, followers, listings, tours, inquiries },
  ownerId, status: 'active'|'suspended'|'deleted',
  createdAt, updatedAt, deletedAt
}
```

Index: `{slug:1}` unique · `{taxCode:1}` sparse · `{type:1,'verification.status':1}` · `{'location.geo':'2dsphere'}` · `{serviceAreas:1}` · `{ownerId:1}`.

## 3. memberships

```js
{ _id, orgId, userId, role: 'owner'|'manager'|'staff',
  permissions: [String],              // override bổ sung, tuỳ chọn
  invitedBy, invitedAt, acceptedAt,
  status: 'invited'|'active'|'revoked', revokedAt, createdAt, updatedAt }
```

Index: `{orgId:1,userId:1}` unique · `{userId:1,status:1}` · `{orgId:1,role:1}`.

Quan trọng: thu hồi membership phải có hiệu lực ngay. Quyền không nhúng trong JWT; mỗi request đọc membership từ cache Redis TTL 60s, và thao tác revoke chủ động xoá cache key `perm:{userId}`.

## 4. places

```js
{
  _id, slug, name: { vi, en }, aliases: [String],   // gồm cả dạng không dấu
  type: 'province'|'district'|'ward'|'attraction'|'beach'|'mountain'|'island'|'park'|'landmark'|'area',
  parentId, ancestors: [ObjectId],                   // materialized path để query nhanh
  geo: { type: 'Point', coordinates: [lng, lat] }, boundingBox,
  description: { vi, en }, media: { coverUrl, gallery: [] },
  bestSeason: [{ fromMonth, toMonth, note: { vi, en } }],
  stats: { postCount, reviewCount, ratingAvg, plannerMentions },
  source: 'seed'|'admin'|'user_suggested', status: 'draft'|'published'|'merged'|'rejected',
  mergedInto, createdBy, createdAt, updatedAt
}
```

Index: `{slug:1}` unique · `{geo:'2dsphere'}` · `{type:1,status:1}` · `{ancestors:1}` · `{aliases:1}`.

## 5. posts

```js
{
  _id,
  author: { kind: 'user'|'org', userId, orgId },      // orgId khi đăng dưới danh nghĩa tổ chức
  type: 'story'|'review'|'question'|'itinerary_share'|'promotion',
  body, bodyHtml,                                     // bodyHtml đã sanitize
  lang: 'vi'|'en'|'other', detectedLang,
  media: [{ kind: 'image'|'video', key, width, height, durationMs,
            variants: { thumb, medium, large }, hlsKey, alt, order }],
  placeId, geo, tags: [String], mentions: [{ kind, id, offset, length }],
  review: { rating: 1..5, targetKind: 'place'|'org', targetId, visitedAt },
  question: { resolvedCommentId },
  itineraryId,
  promotion: { targetKind: 'tour'|'listing', targetId, disclosureLabel: true },
  visibility: 'public'|'followers'|'private',
  counters: { reactions, byType: {...}, comments, shares, saves, views },
  ranking: { engagementScore, qualityScore, lastScoredAt },
  moderation: { state: 'ok'|'auto_flagged'|'under_review'|'hidden'|'removed',
                reportCount, autoFlags: [String], decidedBy, decidedAt, reason },
  status: 'draft'|'processing'|'published'|'hidden_by_author'|'removed',
  publishedAt, createdAt, updatedAt, deletedAt
}
```

Index: `{'author.userId':1,publishedAt:-1}` · `{'author.orgId':1,publishedAt:-1}` · `{placeId:1,publishedAt:-1}` · `{status:1,visibility:1,publishedAt:-1}` · `{tags:1,publishedAt:-1}` · `{'moderation.state':1,'moderation.reportCount':-1}` · `{type:1,'review.targetId':1}`.

Không lưu mảng comment/reaction nhúng trong post (tránh document phình quá 16MB và ghi tranh chấp); dùng collection riêng + counter.

## 6. comments

```js
{ _id, postId, parentId, rootId, depth: 0|1|2,
  author: { kind, userId, orgId },
  body, media: { key, variants }, mentions: [],
  counters: { reactions, replies },
  isPinned, isBestAnswer,
  moderation: { state, reportCount },
  status: 'published'|'removed', createdAt, updatedAt, deletedAt }
```

Index: `{postId:1,parentId:1,createdAt:1}` · `{rootId:1,createdAt:1}` · `{'author.userId':1,createdAt:-1}`.

## 7. reactions

```js
{ _id, targetKind: 'post'|'comment', targetId, userId,
  type: 'like'|'love'|'helpful'|'wow'|'been_there'|'want_to_go', createdAt }
```

Index: `{targetKind:1,targetId:1,userId:1}` unique · `{userId:1,type:1,createdAt:-1}`.

## 8. follows / blocks / mutes

```js
follows: { _id, followerId, targetKind: 'user'|'org', targetId,
           status: 'active'|'pending', createdAt }
blocks:  { _id, userId, blockedUserId, createdAt }
mutes:   { _id, userId, targetKind, targetId, createdAt }
```

Index: `follows{followerId:1,targetKind:1,targetId:1}` unique, `follows{targetKind:1,targetId:1,createdAt:-1}`, `blocks{userId:1,blockedUserId:1}` unique + `blocks{blockedUserId:1}`.

## 8b. collections / collectionItems (bộ sưu tập)

Người dùng lưu bài viết, địa điểm, tour, listing, lịch trình vào các bộ sưu tập cá nhân (kiểu "saved / bookmark board"). Đây là backing store cho endpoint `GET/POST/DELETE /collections` và `/collections/:id/items` trong SPEC-02.

```js
collections: {
  _id, ownerUserId,
  title, description,                          // title bắt buộc, [1..80] ký tự
  slug,                                        // unique theo owner, sinh từ title
  coverImageKey,                               // ảnh bìa (tùy chọn; mặc định lấy item đầu)
  visibility: 'private'|'unlisted'|'public',   // unlisted = truy cập qua link
  shareToken,                                  // sinh khi visibility='unlisted'
  itemCount, followerCount,                    // denormalized counter, cập nhật bằng $inc
  isDefault: Boolean,                          // bộ "Đã lưu" mặc định, không cho xoá
  status: 'active'|'deleted',
  createdAt, updatedAt, deletedAt
}

collectionItems: {
  _id, collectionId, ownerUserId,              // ownerUserId lặp lại để phân quyền nhanh
  targetKind: 'post'|'place'|'tour'|'listing'|'itinerary',
  targetId,
  note,                                        // ghi chú cá nhân, tùy chọn
  order,                                        // thứ tự sắp xếp thủ công (float, cho phép chèn giữa)
  addedAt
}
```

Index: `collections{ownerUserId:1,updatedAt:-1}` · `collections{ownerUserId:1,slug:1}` unique · `collections{shareToken:1}` unique sparse · `collections{visibility:1,followerCount:-1}` (khám phá bộ sưu tập public) · `collectionItems{collectionId:1,order:1}` · `collectionItems{collectionId:1,targetKind:1,targetId:1}` unique (chống lưu trùng) · `collectionItems{ownerUserId:1,targetKind:1,targetId:1}` (kiểm tra "đã lưu chưa" trên feed).

Ràng buộc: mỗi user có đúng một collection `isDefault:true`; xoá collection là xoá mềm + xoá cứng `collectionItems` con trong cùng transaction; khi item đích (post/tour/...) bị xoá, worker dọn `collectionItems` mồ côi qua outbox.

## 9. conversations / messages

```js
conversations: {
  _id, kind: 'dm'|'group'|'inquiry',
  participants: [{ kind: 'user'|'org', userId, orgId, role: 'member'|'admin',
                   joinedAt, lastReadSeq, mutedUntil, leftAt }],
  title, avatarUrl,                              // group
  requestState: 'none'|'pending'|'accepted'|'declined',   // dm từ người lạ
  inquiry: { orgId, subject, relatedKind, relatedId, status, assigneeId },
  lastMessage: { seq, preview, senderId, at },
  seqCounter: Number,                            // tăng đơn điệu, nguồn thứ tự
  createdAt, updatedAt
}
messages: {
  _id, conversationId, seq,
  sender: { kind, userId, orgId },
  body, attachments: [{ kind, key, name, size, mime, variants }],
  replyToSeq, clientMsgId,                       // idempotency phía client
  editedAt, revokedAt,
  deletedFor: [ObjectId],                        // xoá phía tôi
  systemEvent: { type, data },                   // 'member_joined', ...
  createdAt
}
```

Index: `conversations{'participants.userId':1,updatedAt:-1}` · `conversations{'inquiry.orgId':1,'inquiry.status':1}` · `messages{conversationId:1,seq:-1}` · `messages{conversationId:1,clientMsgId:1}` unique sparse.

`seq` cấp phát bằng `findOneAndUpdate($inc: {seqCounter:1})` trên conversation → thứ tự tuyệt đối, không phụ thuộc đồng hồ client.

## 10. tours / listings / availability / inquiries

```js
tours: { _id, orgId, slug, title: {vi,en}, summary: {vi,en},
  destinations: [ObjectId], durationDays, durationNights,
  itinerary: [{ day, title: {vi,en}, description: {vi,en}, placeIds: [], meals: [], accommodation }],
  pricing: [{ paxFrom, paxTo, pricePerPax, currency: 'VND' }],
  inclusions: [{vi,en}], exclusions: [{vi,en}], policies: { cancellation: {vi,en}, payment: {vi,en} },
  media: { coverUrl, gallery: [] }, departures: [{ date, seatsTotal, seatsLeft, priceOverride }],
  seasons: [{ fromMonth, toMonth }], tags: [String],
  status: 'draft'|'published'|'paused'|'archived', counters: { views, inquiries },
  createdAt, updatedAt }

listings: { _id, orgId, kind: 'room'|'table'|'dish'|'service'|'vehicle'|'activity',
  name: {vi,en}, description: {vi,en}, price: { amount, currency, unit: 'night'|'person'|'item'|'hour' },
  capacity: { adults, children }, quantityTotal, amenities: [String],
  media: { gallery: [] }, status, counters: { views, inquiries }, createdAt, updatedAt }

availability: { _id, ownerKind: 'org'|'guide', orgId, userId, refKind: 'listing'|'tour'|'guide',
  refId, date, state: 'open'|'closed'|'booked', quantityLeft, priceOverride, note }

inquiries: { _id, orgId, targetUserId,           // targetUserId cho guide
  fromUserId, kind: 'tour'|'listing'|'guide'|'general',
  refId, message, travelDates: { from, to }, pax: { adults, children },
  budget: { amount, currency }, contact: { name, phone, email },
  status: 'new'|'contacted'|'quoted'|'won'|'lost'|'spam',
  assigneeId, notes: [{ authorId, body, at }],
  conversationId, source: 'planner'|'profile'|'post'|'search',
  createdAt, updatedAt }
```

Index: `tours{orgId:1,status:1}`, `tours{destinations:1,status:1}`, `tours{slug:1}` unique · `listings{orgId:1,kind:1,status:1}` · `availability{refKind:1,refId:1,date:1}` unique · `inquiries{orgId:1,status:1,createdAt:-1}`, `inquiries{targetUserId:1,status:1}`, `inquiries{fromUserId:1,createdAt:-1}`.

## 11. Planner: conversations, messages, itineraries

```js
plannerConversations: { _id, userId, title, locale,
  contextSummary,                                 // tóm tắt các lượt cũ để cắt ngữ cảnh
  itineraryId, pinnedAt, messageCount,
  usage: { promptTokens, completionTokens, costUsd },
  createdAt, updatedAt, deletedAt }

plannerMessages: { _id, conversationId, userId, seq,
  role: 'user'|'assistant'|'system',
  content, contentBlocks: [{ type: 'text'|'itinerary'|'suppliers', data }],
  citations: [{ index, kind: 'kb'|'web'|'platform',
                documentId, chunkId, title, section, url, snippet, fetchedAt }],
  retrieval: { queryRewritten, topK, chunkIds: [], scores: [], rerankUsed, cacheHit },
  webSearch: { used, provider: 'serper', queries: [], resultCount },
  model, finishReason, latencyMs,
  usage: { promptTokens, completionTokens, costUsd },
  feedback: { value: 'up'|'down', reasons: [String], comment, at },
  moderation: { blocked, reason },
  createdAt }

itineraries: { _id, ownerUserId, source: 'planner'|'manual',
  plannerConversationId, title, destinations: [ObjectId],
  dateRange: { from, to }, days: Number,
  pax: { adults, children }, budget: { amount, currency },
  plan: [{ day, date, items: [{ time, kind: 'transport'|'stay'|'eat'|'sightsee'|'activity'|'rest',
                                title, description, placeId, orgId, listingId, tourId,
                                estimatedCost: { amount, currency }, durationMin, note }] }],
  totalEstimatedCost: { amount, currency },
  visibility: 'private'|'public'|'link', shareToken,
  version, createdAt, updatedAt }
```

Index: `plannerConversations{userId:1,updatedAt:-1}` · `plannerMessages{conversationId:1,seq:1}` · `plannerMessages{'feedback.value':1,createdAt:-1}` · `itineraries{ownerUserId:1,updatedAt:-1}` · `itineraries{shareToken:1}` unique sparse.

## 12. Knowledge base

```js
kbDocuments: { _id, title, description,
  sourceKind: 'upload'|'url'|'inline', fileKey, sourceUrl, mimeType, fileSize, checksum,
  lang: 'vi'|'en', regions: [ObjectId], topics: [String],
  audience: ['traveler','agency','business','guide','all'],
  confidence: 'official'|'curated'|'community',
  effectiveFrom, expiresAt,
  status: 'draft'|'processing'|'published'|'unpublished'|'failed'|'expired',
  processing: { jobId, step, progress, error, startedAt, finishedAt },
  stats: { chunkCount, tokenCount, retrievalCount30d, lastRetrievedAt },
  version, versions: [{ version, checksum, fileKey, changedBy, changedAt, note }],
  createdBy, updatedBy, publishedBy, publishedAt, createdAt, updatedAt }

kbChunks: { _id, documentId, ordinal, text, tokenCount,
  heading, section, pageFrom, pageTo,
  lang, regions: [ObjectId], topics: [String],
  vectorId,                                       // point id trong Qdrant
  embedding: { model, dim, updatedAt },
  published: Boolean, editedManually: Boolean,
  stats: { retrievalCount, lastRetrievedAt },
  createdAt, updatedAt }
```

Index: `kbDocuments{status:1,lang:1,regions:1}` · `kbDocuments{expiresAt:1}` · `kbDocuments{checksum:1}` (chống upload trùng) · `kbChunks{documentId:1,ordinal:1}` · `kbChunks{published:1}` · `kbChunks{vectorId:1}` unique.

MongoDB giữ metadata và text gốc của chunk (nguồn để rebuild Qdrant); Qdrant giữ vector + payload phục vụ truy vấn.

## 13. Vận hành & kiểm duyệt

```js
reports: { _id, reporterId, targetKind: 'post'|'comment'|'user'|'message'|'org',
  targetId, reason, detail, evidence: [{ key }],
  status: 'open'|'reviewing'|'resolved'|'dismissed',
  decision: 'keep'|'hide'|'remove'|'remove_and_penalize'|'escalate',
  handlerId, handledAt, appealId, createdAt }

appeals: { _id, userId, subjectKind: 'content'|'account', subjectId,
  originalDecisionBy, body, status: 'open'|'granted'|'denied',
  handlerId, handledAt, createdAt }

auditLogs: { _id, at, actor: { userId, email, roles: [] }, ip, userAgent,
  action, targetKind, targetId, before, after, reason,
  approval: { requiredLevel, approverId, approvedAt },
  traceId }                                        // append-only, không có update/delete API

notifications: { _id, userId, type, actors: [ObjectId], targetKind, targetId,
  payload, groupKey, count, readAt, channels: { inApp, push, email },
  createdAt }

outbox: { _id, aggregate: 'post'|'comment'|'user'|'org'|'tour'|'listing'|'place',
  aggregateId, op: 'upsert'|'delete', payloadVersion,
  status: 'pending'|'processing'|'done'|'failed', attempts, lastError,
  availableAt, createdAt, processedAt }

sessions: { _id, userId, refreshTokenHash, family, device: { ua, os, browser },
  ip, geo, createdAt, lastUsedAt, expiresAt, revokedAt, revokedReason }

idempotencyKeys: { _id, key, userId, endpoint, requestHash,
  responseStatus, responseBody, createdAt }        // TTL 24h

quotaUsage: { _id, userId, day, plannerMessages, webSearches, tokens, costUsd, updatedAt }

systemConfig: { _id, key, value, updatedBy, updatedAt, reason, history: [] }
```

Index: `reports{status:1,createdAt:1}`, `reports{targetKind:1,targetId:1}` · `auditLogs{at:-1}`, `auditLogs{'actor.userId':1,at:-1}`, `auditLogs{targetKind:1,targetId:1}` · `notifications{userId:1,createdAt:-1}`, `notifications{userId:1,readAt:1}`, `notifications{userId:1,groupKey:1}` · `outbox{status:1,availableAt:1}` · `sessions{refreshTokenHash:1}` unique, `sessions{userId:1,revokedAt:1}`, TTL `expiresAt` · `idempotencyKeys{key:1,userId:1}` unique + TTL · `quotaUsage{userId:1,day:1}` unique.

## 14. Nhất quán dữ liệu

- **Transaction** dùng cho các ghi phải nguyên tử: (post + outbox), (message + tăng seq + cập nhật lastMessage), (reaction + counter), (verify org + audit log). MongoDB replica set bắt buộc để có transaction.
- **Counter** cập nhật bằng `$inc` trong cùng transaction với hành động; có job đối chiếu (reconcile) hàng đêm so counter với `countDocuments` và ghi log lệch.
- **Outbox** là cầu duy nhất sang Elasticsearch. Worker xử lý at-least-once, ES upsert idempotent theo `_id` nên an toàn khi xử lý lặp.
- **Xoá dữ liệu**: xoá mềm cho nội dung (giữ để xử lý khiếu nại 90 ngày) → job xoá cứng; xoá tài khoản: ẩn danh hoá (`users` giữ `_id`, xoá PII, `handle` → `deleted_<random>`), đồng thời xoá khỏi ES và các bản sao.
- **Xoá xuyên dịch vụ (cross-service) — bắt buộc cho tuân thủ Nghị định 13/2023 & GDPR**: MongoDB là nguồn sự thật; mọi bản sao phái sinh phải bị xoá/ẩn danh khi user yêu cầu xoá tài khoản hoặc khi nội dung bị gỡ cứng. Điều phối qua outbox để đảm bảo at-least-once, có kiểm tra hoàn tất:
  | Dữ liệu phái sinh | Hành động khi xoá tài khoản | Cơ chế |
  |---|---|---|
  | Elasticsearch (posts/users/orgs...) | Xoá document theo `authorId`/`_id` | outbox `op:delete` → worker ES |
  | Qdrant (kbChunks) | KB do admin nạp → **giữ** (không phải PII user); chỉ xoá point khi document bị unpublish/xoá | không liên quan xoá tài khoản |
  | Qdrant / Redis `semantic_cache` | Purge cache entry chứa nội dung user bị gỡ | job invalidation theo `documentId`/`userId` |
  | `plannerConversations` / `plannerMessages` | Xoá cứng lịch sử chat của user (chứa PII trong prompt) | job xoá theo `userId` |
  | `sessions`, `notifications`, `quotaUsage` | Xoá cứng | job xoá theo `userId` |
  | `auditLogs` | **GIỮ** (nghĩa vụ pháp lý), nhưng ẩn danh trường `actor.email`; đây là ngoại lệ hợp pháp của quyền xoá | ghi đè field, không xoá bản ghi |
  | MinIO (media/avatar/license) | Xoá object theo key thuộc user | job xoá storage |

  Yêu cầu chốt (Definition of Done cho xoá tài khoản): job phát sinh một `deletionReceipt` liệt kê từng dịch vụ + trạng thái (`done`/`skipped_legal`), lưu tối đa cho tới khi tất cả `done`; nếu một dịch vụ fail thì retry, không đánh dấu hoàn tất.
- **Item mồ côi (orphan cleanup)**: khi post/place/tour/listing/itinerary bị xoá cứng, worker phát outbox event để dọn `collectionItems` và các tham chiếu polymorphic trỏ tới nó.
- **Migration** bằng script có version trong `infra/scripts/migrations/`, chạy tuần tự, ghi vào collection `_migrations`, luôn viết kèm hàm rollback.
