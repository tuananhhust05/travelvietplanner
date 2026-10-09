# SPEC-02 — REST API

Base URL: `https://api.travelvietplaner.com/v1` · Nội bộ: `http://api:4000/internal`

## 1. Quy ước chung

| Hạng mục | Quy ước |
|---|---|
| Định dạng | JSON UTF-8; `Content-Type: application/json` |
| Ngôn ngữ | Header `Accept-Language: vi\|en`, override bằng `?lang=` |
| Auth | `Authorization: Bearer <access_token>`; refresh token trong cookie `__Host-rt` (HttpOnly, Secure, SameSite=Strict) |
| Ngữ cảnh tổ chức | Header `X-Org-Id: <orgId>` khi hành động dưới danh nghĩa org |
| Phân trang | Cursor: `?cursor=<opaque>&limit=20` (max 50). Trả `meta.nextCursor` |
| Idempotency | Header `Idempotency-Key: <uuid>` cho mọi POST tạo mới; lặp lại trả cùng kết quả |
| Trace | `X-Request-Id` do client gửi hoặc server sinh; luôn echo lại |
| Versioning | Đường dẫn `/v1`. Thay đổi phá vỡ tương thích → `/v2`, hỗ trợ song song 6 tháng |
| Rate limit | Header `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, và `Retry-After` khi 429 |

### 1.1 Envelope

```json
// Thành công
{ "data": { ... }, "meta": { "nextCursor": "...", "total": 120 } }

// Lỗi
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ",
             "details": [{ "field": "body", "code": "too_long", "max": 5000 }],
             "requestId": "req_01H..." } }
```

`message` đã bản địa hoá theo `Accept-Language`; `code` là hằng số không đổi để client xử lý logic.

### 1.2 Mã lỗi

| HTTP | code | Ý nghĩa |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Payload sai schema |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `MFA_REQUIRED` | Chưa/không còn xác thực |
| 403 | `FORBIDDEN` / `NOT_VERIFIED` / `ACCOUNT_RESTRICTED` | Không đủ quyền |
| 404 | `NOT_FOUND` | Không tồn tại hoặc không có quyền thấy (không phân biệt để chống dò) |
| 409 | `CONFLICT` / `ALREADY_EXISTS` | Xung đột trạng thái |
| 413 | `PAYLOAD_TOO_LARGE` | File/body vượt giới hạn |
| 422 | `UNPROCESSABLE` | Hợp lệ về schema nhưng sai nghiệp vụ |
| 429 | `RATE_LIMITED` / `QUOTA_EXCEEDED` | Vượt hạn mức |
| 451 | `CONTENT_BLOCKED` | Nội dung bị chặn bởi kiểm duyệt |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống (không leak chi tiết) |
| 503 | `DEPENDENCY_UNAVAILABLE` | Phụ thuộc ngoài lỗi, kèm `retryable: true` |

## 2. Auth & Session

| Method | Path | Mô tả |
|---|---|---|
| POST | `/auth/register` | `{ email, password, accountType, locale }` → gửi email xác thực |
| POST | `/auth/verify-email` | `{ token }` |
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, expiresIn }` + set cookie rt. Nếu bật MFA → 401 `MFA_REQUIRED` + `mfaToken` |
| POST | `/auth/mfa/verify` | `{ mfaToken, code }` → token |
| POST | `/auth/refresh` | Dùng cookie rt → cấp cặp mới (rotation). Phát hiện reuse → thu hồi cả family |
| POST | `/auth/logout` | Thu hồi session hiện tại |
| POST | `/auth/logout-all` | Thu hồi mọi session |
| POST | `/auth/password/forgot` | `{ email }` — luôn trả 204 bất kể email tồn tại |
| POST | `/auth/password/reset` | `{ token, newPassword }` → thu hồi mọi session |
| POST | `/auth/password/change` | `{ current, next }` |
| GET | `/auth/oauth/google` · `/auth/oauth/google/callback` | OAuth (PKCE + state) |
| GET/POST/DELETE | `/auth/mfa` | Lấy QR setup, kích hoạt, tắt (yêu cầu mật khẩu) |
| GET | `/auth/sessions` · DELETE `/auth/sessions/:id` | Liệt kê / thu hồi thiết bị |

## 3. Users & Organizations

| Method | Path | Mô tả |
|---|---|---|
| GET | `/me` | Profile + roles + memberships + quota hiện tại |
| PATCH | `/me` | Cập nhật profile, locale, privacy, notificationPrefs |
| POST | `/me/avatar` | Upload (pre-signed) |
| DELETE | `/me` | Yêu cầu xoá tài khoản (grace 30 ngày) |
| GET | `/me/export` | Xuất dữ liệu cá nhân (job bất đồng bộ, trả link tải) |
| GET | `/users/:handle` | Profile công khai (tôn trọng `privacy.profileVisibility`) |
| GET | `/users/:handle/posts` | Bài viết công khai, cursor |
| POST/DELETE | `/users/:id/follow` | Follow / unfollow |
| POST/DELETE | `/users/:id/block` · `/mute` | Chặn / ẩn |
| GET | `/users/:id/followers` · `/following` | Danh sách |
| POST | `/orgs` | Tạo tổ chức (agency/business) → `pending_verification` |
| GET | `/orgs/:slug` | Trang công khai |
| PATCH | `/orgs/:id` | Cập nhật (cần `org.manager`+) |
| POST | `/orgs/:id/documents` | Upload giấy tờ verify |
| POST | `/orgs/:id/submit-verification` | Gửi duyệt |
| GET/POST/PATCH/DELETE | `/orgs/:id/members` | Quản lý nhân sự (cần `org.owner`) |
| POST | `/orgs/invites/:token/accept` | Nhận lời mời |
| GET | `/orgs/:id/dashboard` | Chỉ số cho portal |
| GET | `/guides/:handle` | Hồ sơ guide công khai |
| PATCH | `/guides/me` | Cập nhật hồ sơ nghề nghiệp |

## 4. Social

| Method | Path | Mô tả |
|---|---|---|
| POST | `/posts` | Tạo bài. `{ type, body, mediaKeys[], placeId, tags[], visibility, review?, promotion? }` → 202 nếu có media |
| GET | `/posts/:id` | Chi tiết (kiểm tra visibility) |
| PATCH | `/posts/:id` | Sửa body/tags/visibility (không đổi type, không thêm media sau 24h) |
| DELETE | `/posts/:id` | Xoá mềm |
| GET | `/feed?tab=for_you\|following\|nearby` | Feed, cursor |
| GET | `/posts/:id/comments?sort=relevant\|new\|old` | Comment gốc + 3 reply đầu |
| POST | `/posts/:id/comments` | `{ body, parentId?, mediaKey? }` |
| PATCH/DELETE | `/comments/:id` | Sửa / xoá |
| POST | `/comments/:id/pin` · `/best-answer` | Ghim / chọn câu trả lời hay |
| PUT/DELETE | `/reactions` | `{ targetKind, targetId, type }` — PUT là upsert |
| POST | `/posts/:id/share` | Repost hoặc tạo link |
| GET/POST/DELETE | `/collections` · `/collections/:id/items` | Bộ sưu tập |
| POST | `/media/presign` | `{ kind, mime, size }` → `{ uploadUrl, key, expiresIn }` |
| POST | `/reports` | `{ targetKind, targetId, reason, detail }` |

### 4.1 Upload media

Client gọi `/media/presign` → PUT trực tiếp lên S3 → gửi `mediaKeys` khi tạo post. Server chỉ nhận key thuộc `uploads/{userId}/` để chống chiếm dụng. Worker xác minh magic bytes, kích thước thật, quét malware; file không hợp lệ bị xoá và post chuyển `failed` kèm thông báo.

## 5. Messaging

| Method | Path | Mô tả |
|---|---|---|
| GET | `/conversations?kind=dm\|group\|inquiry` | Danh sách, cursor theo `updatedAt` |
| POST | `/conversations` | `{ kind, participantIds[], title? }` — idempotent với DM (trả conversation cũ nếu đã có) |
| GET | `/conversations/:id/messages?before=<seq>` | Lịch sử, mặc định 50 tin gần nhất |
| POST | `/conversations/:id/messages` | `{ body, attachments[], replyToSeq?, clientMsgId }` |
| POST | `/conversations/:id/read` | `{ seq }` — cập nhật `lastReadSeq` |
| DELETE | `/messages/:id?scope=me\|all` | Xoá phía tôi / thu hồi (≤5 phút) |
| POST | `/conversations/:id/accept` · `/decline` | Xử lý message request |
| PATCH | `/conversations/:id` | Đổi tên, mute, thêm/bớt thành viên (group) |

## 6. Discovery & Search

| Method | Path | Mô tả |
|---|---|---|
| GET | `/search?q=&type=post\|user\|org\|place\|tour\|listing&...filters` | Tìm kiếm (Elasticsearch) |
| GET | `/search/suggest?q=` | Autocomplete (≤100ms) |
| GET | `/places?type=&parentId=&near=lng,lat&radius=` | Danh sách địa điểm |
| GET | `/places/:slug` | Chi tiết + bài viết + review + nhà cung cấp lân cận |
| POST | `/places/suggest` | Đề xuất địa điểm mới (chờ admin duyệt) |
| GET | `/tours?destination=&durationDays=&priceMax=` | Tour đã publish của org verified |
| GET | `/tours/:slug` · `/listings/:id` | Chi tiết |
| GET | `/guides?region=&language=&date=` | Tìm HDV còn trống |

## 7. Portal nhà cung cấp

| Method | Path | Ghi chú |
|---|---|---|
| GET/POST/PATCH/DELETE | `/orgs/:id/tours` | CRUD tour; publish yêu cầu org `verified` |
| GET/POST/PATCH/DELETE | `/orgs/:id/listings` | CRUD listing |
| GET/PUT | `/availability?refKind=&refId=&from=&to=` | Đọc/ghi lịch trống theo lô |
| GET | `/inquiries?scope=org\|guide&status=` | Hàng đợi lead |
| PATCH | `/inquiries/:id` | Đổi status, gán assignee, thêm note |
| POST | `/inquiries` | Traveler gửi yêu cầu → tạo conversation kèm theo |
| GET | `/reviews?targetKind=&targetId=` · POST `/reviews/:id/reply` | Xem/phản hồi đánh giá |

## 8. Planner

| Method | Path | Mô tả |
|---|---|---|
| GET | `/planner/conversations` | Danh sách hội thoại |
| POST | `/planner/conversations` | Tạo mới `{ title?, locale? }` |
| PATCH/DELETE | `/planner/conversations/:id` | Đổi tên, ghim, xoá |
| GET | `/planner/conversations/:id/messages` | Lịch sử kèm citations |
| POST | `/planner/conversations/:id/messages` | **SSE stream**. Body `{ content, clientMsgId }` |
| POST | `/planner/messages/:id/regenerate` | Sinh lại lượt cuối |
| POST | `/planner/messages/:id/feedback` | `{ value: 'up'\|'down', reasons[], comment }` |
| GET | `/planner/suggestions` | 4 prompt gợi ý cá nhân hoá |
| GET | `/planner/quota` | Hạn mức còn lại + thời điểm reset |
| GET/POST/PATCH/DELETE | `/itineraries` · `/itineraries/:id` | CRUD lịch trình |
| POST | `/itineraries/:id/share` | Tạo shareToken hoặc post |
| GET | `/itineraries/:id/pdf` | Xuất PDF (job, trả link) |
| POST | `/itineraries/:id/inquiries` | Gửi inquiry hàng loạt tới nhà cung cấp trong lịch trình |

### 8.1 Định dạng SSE

```
event: meta
data: {"messageId":"...","model":"gemini-2.5-flash","traceId":"..."}

event: status
data: {"step":"retrieving","label":{"vi":"Đang tìm trong cẩm nang…","en":"Searching knowledge base…"}}

event: delta
data: {"text":"Đà Nẵng 3 ngày 2 đêm phù hợp"}

event: citations
data: {"citations":[{"index":1,"kind":"kb","documentId":"...","title":"Cẩm nang Đà Nẵng","section":"Di chuyển","updatedAt":"2026-06-01"}]}

event: block
data: {"type":"itinerary","data":{ ...itinerary có cấu trúc... }}

event: usage
data: {"promptTokens":3120,"completionTokens":640,"costUsd":0.0021}

event: done
data: {"finishReason":"stop","latencyMs":8420}

event: error
data: {"code":"DEPENDENCY_UNAVAILABLE","retryable":true}
```

Client huỷ bằng cách abort request; server nhận `req.on('close')` → gửi tín hiệu cancel tới rag-service → lưu phần đã sinh với `finishReason: 'cancelled'`.

## 9. Notifications

| Method | Path |
|---|---|
| GET | `/notifications?unreadOnly=true` |
| POST | `/notifications/read` — `{ ids[] }` hoặc `{ all: true }` |
| GET | `/notifications/unread-count` |
| POST/DELETE | `/push/devices` — đăng ký/hủy token FCM |

## 10. Admin

Tất cả yêu cầu role platform tương ứng và MFA. Mọi ghi đều tạo audit log.

| Method | Path | Role |
|---|---|---|
| GET | `/admin/dashboard` | moderator+ |
| GET | `/admin/users?...` · GET `/admin/users/:id` | admin |
| POST | `/admin/users/:id/actions` | admin — `{ action, reason, duration?, features? }` |
| POST | `/admin/users/:id/roles` | super_admin |
| GET | `/admin/verifications?status=pending` | admin |
| POST | `/admin/verifications/:id/decide` | admin — `{ decision, reason }` |
| GET | `/admin/moderation/queue?tab=` | moderator |
| POST | `/admin/moderation/:reportId/decide` | moderator |
| GET | `/admin/appeals` · POST `/admin/appeals/:id/decide` | admin (khác người quyết định đầu) |
| GET/POST | `/admin/kb/documents` | kb_editor |
| GET/PATCH/DELETE | `/admin/kb/documents/:id` | kb_editor |
| POST | `/admin/kb/documents/:id/publish` · `/unpublish` · `/reprocess` | kb_editor |
| GET/PATCH/DELETE | `/admin/kb/documents/:id/chunks` · `/chunks/:chunkId` | kb_editor |
| POST | `/admin/kb/playground` | kb_editor — `{ query, topK, threshold, rerank, lang }` |
| GET | `/admin/kb/feedback?value=down` | kb_editor |
| GET/POST/PATCH | `/admin/places` · `/admin/places/:id/merge` | admin |
| GET/PUT | `/admin/config/:key` | admin (nhóm AI/Security cần phê duyệt cấp 2) |
| GET | `/admin/audit-logs?actor=&target=&from=&to=` | admin |
| GET | `/admin/reports/export?type=` | admin |

### 10.1 Phê duyệt cấp 2

Hành động cần hai người: POST trả `202` + `{ approvalId }`, trạng thái `pending_approval`. Admin thứ hai gọi `POST /admin/approvals/:id/approve` để thực thi. Người tạo không thể tự phê duyệt. Yêu cầu hết hạn sau 24h.

## 11. Internal API (không expose ra Internet)

| Method | Path | Gọi bởi |
|---|---|---|
| POST | `/internal/rag/query` (SSE) | api → rag-service |
| POST | `/internal/rag/ingest` | api → rag-service |
| POST | `/internal/rag/reindex` | api → rag-service |
| GET | `/internal/rag/health` | api, monitoring |
| POST | `/internal/platform/lookup` | rag-service → api (tra place/tour/listing/guide đã verified) |
| POST | `/internal/kb/progress` | rag-service → api (báo tiến độ ingest) |

Xác thực nội bộ: header `X-Service-Token` (HMAC-SHA256 của body + timestamp, chống replay bằng cửa sổ 5 phút), thêm mTLS ở production. Network policy chỉ cho phép traffic trong docker network nội bộ.

## 12. Health & Meta

| Path | Mô tả |
|---|---|
| `GET /healthz` | Liveness — luôn 200 nếu process sống |
| `GET /readyz` | Readiness — kiểm MongoDB, Redis, ES, Qdrant; 503 nếu thiếu phụ thuộc bắt buộc |
| `GET /metrics` | Prometheus (chỉ mạng nội bộ) |
| `GET /v1/config/public` | Feature flag công khai, giới hạn upload, danh sách locale |

## 13. OpenAPI

Schema sinh từ Zod bằng `zod-to-openapi`, phục vụ tại `/v1/openapi.json` và Swagger UI tại `/v1/docs` (chặn ở production hoặc yêu cầu auth). CI kiểm tra: mọi route có schema request/response, không có route thiếu tài liệu, và diff schema được review khi có thay đổi phá vỡ tương thích.

## 14. Định mức Rate Limit & Quota

Hai cơ chế tách biệt: **rate limit** (chống lạm dụng/DDoS tầng ứng dụng, tính bằng req/cửa sổ thời gian, trả `429 RATE_LIMITED`) và **quota** (giới hạn sử dụng theo gói/ngày cho tài nguyên đắt như planner, trả `429 QUOTA_EXCEEDED`). Rate limit dùng thuật toán **sliding window** lưu trên Redis, khoá theo `userId` (đã đăng nhập) hoặc `ip` (ẩn danh). Cloudflare/Nginx là lớp phòng thủ phía trước (xem SPEC-05 §6); các con số dưới đây là lớp ứng dụng.

### 14.1 Rate limit theo nhóm endpoint

| Nhóm | Endpoint tiêu biểu | Khách ẩn danh (theo IP) | Đã đăng nhập (theo user) | Cửa sổ |
|---|---|---|---|---|
| Auth nhạy cảm | `/auth/login`, `/auth/mfa/verify`, `/auth/password/forgot` | 5 / IP | 10 / user | 15 phút |
| Auth khác | `/auth/register`, `/auth/refresh`, `/auth/verify-email` | 10 / IP | 30 / user | 15 phút |
| Đọc chung (GET) | feed, posts, profile, search, places | 60 / IP | 300 / user | 1 phút |
| Ghi nội dung | POST/PATCH `/posts`, `/comments`, `/reactions` | — (bắt buộc auth) | 60 / user | 1 phút |
| Chống spam ghi | POST `/posts` (tạo mới) | — | 15 / user | 1 giờ |
| Media presign | `/media/presign` | — | 30 / user | 1 giờ |
| Nhắn tin | POST tin nhắn (REST fallback) + gửi qua socket | — | 120 / user | 1 phút |
| Follow/relationship | `/follows`, `/blocks`, `/mutes` | — | 60 / user | 1 phút |
| Report/appeal | `/reports`, `/appeals` | — | 20 / user | 1 giờ |
| Planner (chat AI) | `/planner/messages` (SSE) | — | Theo quota tier (xem 14.2) | — |
| Admin | `/admin/*` | — | 600 / user | 1 phút |
| Internal | `/internal/*` | Không expose Internet; chỉ HMAC + mTLS, không rate limit theo user | — | — |

Giá trị cụ thể lưu trong `systemConfig` (key `rateLimit.*`), cho phép admin điều chỉnh nóng không cần deploy; bảng trên là default seed.

### 14.2 Quota planner theo gói (reset 00:00 giờ VN)

| Tier | Tin nhắn planner/ngày | Web search (Serper)/ngày | Token/ngày (mềm) |
|---|---|---|---|
| traveler (free) | 30 | 15 | 200k |
| guide / org.staff | 80 | 40 | 500k |
| org.manager / org.owner | 150 | 80 | 1M |
| Nội bộ/admin test | không giới hạn (ghi log) | không giới hạn | — |

Khi chạm quota: trả `429 QUOTA_EXCEEDED` kèm `meta.resetAt`. Quota theo dõi trong collection `quotaUsage` (xem SPEC-01 §13), cập nhật bằng `$inc` sau mỗi lượt hoàn tất. Vượt token mềm → cảnh báo nhưng vẫn phục vụ tới hết lượt đang chạy; lạm dụng lặp lại → hạ ưu tiên hàng đợi.

### 14.3 Header trả về

Mọi response chịu rate limit trả `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (epoch giây). Khi `429`: thêm `Retry-After` (giây). Endpoint có quota trả thêm `X-Quota-Remaining` và `X-Quota-Reset`.
