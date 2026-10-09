# SPEC-05 — Bảo mật, mã hoá & chống DDoS

Nguyên tắc: deny by default · phòng thủ nhiều lớp · đặc quyền tối thiểu · giả định đã bị xâm nhập.

## 1. Mã hoá

### 1.1 In-transit

| Đoạn | Cấu hình |
|---|---|
| Client ↔ Cloudflare | TLS 1.3 (fallback 1.2), HSTS `max-age=63072000; includeSubDomains; preload` |
| Cloudflare ↔ origin | Full (strict), certificate pinning tới Cloudflare Origin CA |
| Nginx ↔ service | Mạng docker nội bộ; mTLS cho `api ↔ rag` ở production |
| api ↔ MongoDB/Redis/ES/Qdrant | TLS bật, chứng chỉ nội bộ, xác thực bằng user riêng cho từng service |

Cipher chỉ AEAD (`TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`, `ECDHE-RSA-AES256-GCM-SHA384`). Tắt TLS 1.0/1.1, RC4, 3DES, cipher không có forward secrecy. OCSP stapling bật. Kiểm tra định kỳ bằng SSL Labs, mục tiêu hạng A+.

### 1.2 At-rest

Ba tầng:

1. **Volume encryption** — LUKS (self-host) hoặc EBS/PD encryption (cloud) cho toàn bộ data volume của MongoDB, Redis, ES, Qdrant, MinIO.
2. **Database encryption** — MongoDB Enterprise dùng WiredTiger encryption; MongoDB Community dựa vào tầng 1.
3. **Field-level encryption** — mã hoá ở tầng ứng dụng trước khi ghi, cho các trường sau:

| Trường | Lý do | Kiểu |
|---|---|---|
| `users.phone.e164` | PII, cần tra cứu chính xác | Deterministic (AES-256-SIV) → cho phép truy vấn bằng giá trị mã hoá |
| `users.mfa.secret` | Bí mật xác thực | Randomized (AES-256-GCM) |
| `organizations.documents[].ocrData` | Số giấy tờ, PII | Randomized |
| `organizations.taxCode` | Cần tra cứu trùng | Deterministic |
| `messages.body`, `messages.attachments[].name` | Nội dung riêng tư | Randomized |
| `inquiries.contact.phone/email` | PII | Randomized |
| `sessions.ip`, `auditLogs.ip` | PII theo NĐ13 | Deterministic (cần lọc theo IP khi điều tra) |

Deterministic encryption có đánh đổi: kẻ tấn công đọc được DB có thể suy ra hai bản ghi cùng giá trị. Chỉ dùng cho trường buộc phải truy vấn được, và không dùng cho trường có miền giá trị nhỏ.

### 1.3 Quản lý khoá

- KMS: AWS KMS / GCP KMS ở production; ở dev dùng khoá local trong `.env` (không bao giờ commit).
- Envelope encryption: KMS giữ Customer Master Key; Data Encryption Key được KMS bọc, cache trong bộ nhớ 5 phút.
- Luân chuyển khoá: DEK mỗi 90 ngày, CMK mỗi năm. Dữ liệu cũ giữ `keyVersion` để giải mã ngược; job re-encrypt chạy nền.
- Secret ứng dụng (JWT key, API key Gemini/Serper, DB password): Docker secrets / cloud secret manager. Không có secret nào trong image, trong git, hay trong log. CI có bước `gitleaks` chặn commit chứa secret.
- Mật khẩu: Argon2id, `memoryCost=19456 KiB, timeCost=2, parallelism=1` (khuyến nghị OWASP 2024), salt riêng mỗi mật khẩu, pepper toàn hệ thống lưu ở KMS.

## 2. Xác thực

### 2.1 Token

| Token | Thời hạn | Nơi lưu | Nội dung |
|---|---|---|---|
| Access | 15 phút | Bộ nhớ JS (không localStorage) | `sub`, `sid`, `accountType`, `tokenVersion`, `iat`, `exp`, `aud`, `iss` |
| Refresh | 30 ngày | Cookie `__Host-rt` HttpOnly Secure SameSite=Strict Path=/ | Opaque random 32 byte; DB lưu SHA-256 |
| MFA challenge | 5 phút | Body response | `sub`, `purpose: 'mfa'` |
| Email/reset | 24h / 1h | Link email | Opaque, một lần dùng, DB lưu hash |
| Service (nội bộ) | 5 phút | Header | HMAC-SHA256(body + timestamp + nonce) |

Access token **không chứa quyền hạn**. Quyền đọc từ Redis cache `perm:{userId}` TTL 60s, nguồn là `users.platformRoles` + `memberships`. Thu hồi quyền hoặc membership xoá cache ngay → hiệu lực trong request kế tiếp. `tokenVersion` trong JWT so với DB để vô hiệu hoá toàn bộ access token của một user tức thì (đổi mật khẩu, bị khoá, logout-all).

Ký JWT bằng RS256 với cặp khoá luân chuyển; JWKS nội bộ, giữ 2 khoá (current + previous) để rollover không gián đoạn.

### 2.2 Refresh token rotation

Mỗi lần refresh cấp token mới và vô hiệu token cũ, cùng `family` (chuỗi phiên). Nếu một token đã dùng lại xuất hiện lần nữa → dấu hiệu bị đánh cắp → **thu hồi toàn bộ family**, gửi email cảnh báo, ghi audit log. Đây là phòng thủ chuẩn cho token lưu ở cookie.

### 2.3 MFA

TOTP RFC 6238, SHA-1, 6 số, chu kỳ 30s, cho phép lệch ±1 window. Secret 160 bit, mã hoá at-rest. 10 mã backup dùng một lần (Argon2id hash). Bắt buộc cho `moderator`, `kb_editor`, `admin`, `super_admin`, `org.owner`. Rate limit xác thực TOTP: 5 lần/5 phút/tài khoản. Tắt MFA yêu cầu nhập mật khẩu + một mã TOTP hợp lệ.

### 2.4 Chống dò mật khẩu

- Đếm sai theo (tài khoản) và theo (IP): 5 lần sai → khoá tài khoản 15 phút, tăng gấp đôi tới tối đa 24h.
- Thời gian phản hồi hằng số cho login sai/đúng (chống timing attack); luôn chạy Argon2 dù email không tồn tại.
- Thông báo lỗi chung "Email hoặc mật khẩu không đúng" — không tiết lộ email tồn tại.
- Kiểm tra mật khẩu rò rỉ qua HIBP range API (k-anonymity, chỉ gửi 5 ký tự đầu của SHA-1).
- CAPTCHA (Cloudflare Turnstile) sau 3 lần sai, và trên form đăng ký, quên mật khẩu.

## 3. Phân quyền (RBAC)

### 3.1 Ma trận quyền (trích)

| Permission | traveler | guide | org.staff | org.manager | org.owner | moderator | kb_editor | admin | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `post:create:own` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `post:create:org` | | | ⚠ | ✓ | ✓ | | | | |
| `post:delete:own` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `post:delete:any` | | | | | | ✓ | | ✓ | ✓ |
| `post:hide:any` | | | | | | ✓ | | ✓ | ✓ |
| `org.tour:write` | | | | ✓ | ✓ | | | | |
| `org.member:write` | | | | | ✓ | | | | ✓ |
| `inquiry:read:org` | | | ✓ | ✓ | ✓ | | | | |
| `guide.profile:write:own` | | ✓ | | | | | | | |
| `report:handle` | | | | | | ✓ | | ✓ | ✓ |
| `user:suspend` | | | | | | ⚠ tạm | | ✓ | ✓ |
| `user:delete` | | | | | | | | ⚠ 2-man | ✓ |
| `kb:write` | | | | | | | ✓ | ✓ | ✓ |
| `kb:publish` | | | | | | | ✓ | ✓ | ✓ |
| `config:write:ai` | | | | | | | | ⚠ 2-man | ✓ |
| `role:grant` | | | | | | | | | ✓ |
| `audit:read` | | | | | | ⚠ own | | ✓ | ✓ |

⚠ = có điều kiện (cần duyệt, chỉ phạm vi của mình, hoặc cần phê duyệt cấp 2).

### 3.2 Thực thi

Kiểm tra ở **tầng service**, không chỉ ở middleware route. Lý do: cùng một service có thể được gọi từ nhiều route và từ worker; nếu chỉ chặn ở route thì một đường dẫn mới sẽ vô tình bỏ qua kiểm tra.

```ts
// modules/posts/post.service.ts
async deletePost(ctx: AuthContext, postId: string) {
  const post = await this.repo.findById(postId);
  if (!post) throw new NotFoundError();                 // không phân biệt "không có" vs "không được xem"
  const own = post.author.userId?.equals(ctx.userId);
  ctx.require(own ? 'post:delete:own' : 'post:delete:any', { resource: post });
  ...
}
```

`ctx.require` đọc quyền hiệu lực từ cache, ném `ForbiddenError` nếu thiếu, và ghi metric `authz_denied` kèm permission để phát hiện lỗi cấu hình hoặc hành vi dò quyền.

Kiểm soát cấp đối tượng (object-level): mọi truy vấn theo `orgId` phải bổ sung điều kiện `orgId ∈ ctx.orgIds`. Test tự động sinh request chéo giữa hai org để chắc không rò rỉ (chống IDOR) — đây là lớp lỗi phổ biến nhất ở API multi-tenant.

## 4. Kiểm tra đầu vào

| Nguy cơ | Biện pháp |
|---|---|
| Payload sai định dạng | Zod schema cho mọi body/query/param; `strict()` để từ chối trường lạ; giới hạn body 1MB (10MB cho upload metadata) |
| NoSQL injection | Không bao giờ nhận operator từ client. Sanitize key bắt đầu bằng `$` hoặc chứa `.`; ép kiểu ObjectId tường minh; truy vấn dựng bằng builder, không nối chuỗi |
| XSS | Nội dung người dùng render dạng text; rich text sanitize bằng DOMPurify server-side với allowlist tag/attr hẹp; CSP chặn inline script |
| SSRF | Nhập URL (KB từ URL, OG preview): allowlist scheme http/https, chặn IP nội bộ (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7), resolve DNS trước rồi kết nối bằng IP đã kiểm tra (chống DNS rebinding), không theo redirect quá 2 lần, timeout 5s, giới hạn 5MB |
| Path traversal | Key S3 sinh từ server (`uploads/{userId}/{uuid}.{ext}`), không dùng tên file client; kiểm tra key thuộc prefix của user |
| Upload độc hại | Kiểm magic bytes khớp MIME khai báo, giới hạn kích thước và số lượng, tái mã hoá ảnh bằng sharp (loại bỏ payload nhúng và EXIF), quét ClamAV, lưu ngoài web root, phục vụ qua CDN với `Content-Disposition: attachment` cho file không phải media |
| Prototype pollution | Không `Object.assign` vào object từ client; dùng `Object.create(null)` cho map; chặn key `__proto__`, `constructor`, `prototype` |
| ReDoS | Không dùng regex do người dùng cung cấp; regex nội bộ kiểm tra bằng `safe-regex`; tìm kiếm `$regex` ở MongoDB chỉ dùng tiền tố đã escape |
| Mass assignment | Whitelist trường cho mỗi endpoint update; không bao giờ spread body vào `$set` |
| Zip bomb | Không giải nén file người dùng ở v1 |

## 5. Header bảo mật

```
Content-Security-Policy: default-src 'self';
  script-src 'self' 'nonce-{random}' https://challenges.cloudflare.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://cdn.travelvietplaner.com;
  media-src 'self' https://cdn.travelvietplaner.com;
  connect-src 'self' https://api.travelvietplaner.com wss://api.travelvietplaner.com;
  frame-src https://challenges.cloudflare.com;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
  object-src 'none'; upgrade-insecure-requests;
  report-uri /api/csp-report
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
Cache-Control: no-store        (cho mọi response chứa dữ liệu cá nhân)
```

Không dùng `unsafe-inline` cho script — Next.js dùng nonce. `style-src 'unsafe-inline'` là nhượng bộ cho Tailwind runtime; đánh giá loại bỏ ở v1.5.

CORS: allowlist tường minh `https://travelvietplaner.com`, `https://www.travelvietplaner.com`, `https://admin.travelvietplaner.com`; `credentials: true`; không bao giờ phản chiếu `Origin` từ request.

CSRF: refresh token cookie dùng `SameSite=Strict` + double-submit token cho các endpoint dùng cookie. API chính dùng Bearer token nên miễn nhiễm CSRF, nhưng `/auth/refresh` và `/auth/logout` (dùng cookie) vẫn yêu cầu header `X-CSRF-Token` khớp cookie `csrf`.

## 6. Chống DDoS & lạm dụng

Bốn lớp, mỗi lớp chặn một loại tấn công khác nhau:

### Lớp 1 — Cloudflare (biên)

- Chống L3/L4 (SYN flood, UDP amplification) tự động, không cần cấu hình.
- WAF managed ruleset (OWASP Core) + custom rule: chặn user-agent rỗng, chặn quốc gia có tỷ lệ tấn công cao khi đang bị tấn công, chặn request tới `/admin` không từ IP allowlist.
- Bot Fight Mode + Turnstile challenge cho endpoint đăng ký/đăng nhập.
- Rate limiting ở biên: 1000 req/phút/IP toàn site (ngưỡng thô, chỉ để cắt flood).
- Under Attack Mode bật thủ công khi có sự cố; DNS proxy bắt buộc để ẩn IP origin.
- Origin chỉ nhận kết nối từ dải IP Cloudflare (firewall cấp máy chủ) — nếu không, kẻ tấn công tìm được IP thật sẽ đi vòng qua mọi lớp bảo vệ.

### Lớp 2 — Nginx

```nginx
limit_req_zone $binary_remote_addr zone=general:20m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m    rate=1r/s;
limit_req_zone $http_x_user_id    zone=planner:10m rate=10r/m;
limit_conn_zone $binary_remote_addr zone=conn:10m;

client_max_body_size 12m;
client_body_timeout 15s;
client_header_timeout 10s;
send_timeout 20s;
keepalive_timeout 30s;
limit_conn conn 40;

location /v1/auth/    { limit_req zone=auth burst=5 nodelay; }
location /v1/planner/ { limit_req zone=planner burst=3; proxy_read_timeout 120s; }
location /            { limit_req zone=general burst=60 nodelay; }
```

`client_body_timeout` và `client_header_timeout` ngắn để chống Slowloris. Buffer request đầy đủ trước khi chuyển tới upstream (`proxy_request_buffering on`) để backend không bị giữ kết nối bởi client gửi chậm.

### Lớp 3 — Rate limit ở ứng dụng (Redis, sliding window)

Thuật toán: sliding window log rút gọn bằng Lua script atomic trên Redis, khoá theo `(scope, identity, endpoint)`. Identity = userId nếu đã đăng nhập, ngược lại IP đã băm.

| Endpoint / hành động | Hạn mức | Cửa sổ |
|---|---|---|
| `POST /auth/login` | 5 | 15 phút / tài khoản, và 20 / 15 phút / IP |
| `POST /auth/register` | 3 | 1 giờ / IP |
| `POST /auth/password/forgot` | 3 | 1 giờ / email |
| `POST /auth/mfa/verify` | 5 | 5 phút / tài khoản |
| `POST /posts` | 10 | 1 giờ |
| `POST /comments` | 60 | 1 giờ |
| `PUT /reactions` | 300 | 1 giờ |
| `POST /follow` | 100 | 1 giờ |
| `POST /messages` | 50 | 1 phút |
| Hội thoại DM mới với người lạ | 20 | 1 ngày |
| `POST /planner/.../messages` | theo quota tier | 1 ngày |
| `POST /media/presign` | 100 | 1 giờ |
| `POST /reports` | 20 | 1 ngày |
| `GET /search` | 120 | 1 phút |
| Toàn bộ API (đã đăng nhập) | 600 | 1 phút |
| Toàn bộ API (chưa đăng nhập) | 100 | 1 phút |

Tài khoản mới (< 24h) và tài khoản `trustScore < 30` áp hạn mức bằng 30% giá trị trên. Đây là biện pháp chống spam hiệu quả hơn CAPTCHA vì không ảnh hưởng người dùng thật.

Vượt hạn mức → 429 + `Retry-After`. Vượt liên tục 10 lần trong 10 phút → chặn identity 1 giờ và ghi cảnh báo.

### Lớp 4 — Bảo vệ endpoint đắt tiền

Endpoint planner tốn tiền thật (token LLM) nên cần nhiều lớp riêng:

- Bắt buộc đăng nhập + email đã xác thực. Không có tier ẩn danh.
- Quota theo ngày ghi ở `quotaUsage`, kiểm tra atomic bằng `$inc` có điều kiện trước khi gọi rag-service.
- Giới hạn đồng thời: mỗi user tối đa 1 stream planner đang chạy; request thứ hai trả 409.
- Ngân sách chi phí toàn hệ thống mỗi ngày; đạt 100% → tạm khoá planner cho tier free, giữ cho nhà cung cấp và admin, gửi alert.
- Circuit breaker: 5 lỗi liên tiếp từ Gemini → mở 30s, trả 503 `retryable` thay vì xếp hàng chờ (chống thundering herd).
- Timeout cứng 120s cho toàn bộ một lượt; kèm queue với bounded size, đầy thì trả 503 ngay chứ không xếp hàng vô hạn.

### Chống lạm dụng khác

| Vector | Biện pháp |
|---|---|
| Bơm phồng lưu trữ | Quota dung lượng: traveler 2GB, nhà cung cấp 20GB. Xoá file mồ côi (uploaded nhưng không gắn post) sau 24h |
| Cào dữ liệu (scraping) | Phân trang bắt buộc, không có endpoint trả toàn bộ, giới hạn `limit` ≤ 50, phát hiện mẫu truy cập tuần tự → challenge |
| Dò enumeration | 404 thay vì 403 cho tài nguyên không có quyền; handle không tuần tự; ObjectId không tiết lộ thứ tự tạo có ý nghĩa |
| Amplification qua webhook | Không có webhook ra ngoài ở v1 |
| Zip/regex bomb | Không giải nén, không regex từ người dùng |

## 7. Ghi log & audit

### 7.1 Nguyên tắc log

Log JSON có cấu trúc, luôn kèm `traceId`, `requestId`, `userId` (nếu có), `route`, `statusCode`, `durationMs`.

**Không bao giờ log**: mật khẩu, token (access/refresh/reset), MFA secret hoặc mã, số điện thoại đầy đủ, email đầy đủ (chỉ log dạng `a***@domain.com`), nội dung tin nhắn, nội dung tài liệu KB, số giấy tờ, header `Authorization`, `Cookie`.

Thực thi bằng redactor ở tầng logger với danh sách khoá cấm và regex phát hiện token/JWT — không dựa vào lập trình viên tự nhớ. CI có test kiểm tra redactor hoạt động.

### 7.2 Audit log

Ghi cho mọi hành động đặc quyền hoặc thay đổi trạng thái quan trọng: login/logout, đổi mật khẩu, bật/tắt MFA, thay đổi role, mọi hành động admin, verify org, quyết định kiểm duyệt, publish/unpublish KB, thay đổi config, xuất dữ liệu, xoá tài khoản.

Bất biến: collection `auditLogs` chỉ cấp quyền `insert` và `find` cho user ứng dụng ở MongoDB — không có `update`/`delete`. Xuất định kỳ sang lưu trữ chỉ-ghi (S3 Object Lock, chế độ compliance) để chống sửa ngay cả khi DB bị xâm nhập. Giữ 2 năm.

Ghi kèm `before`/`after` cho thay đổi dữ liệu, và `reason` bắt buộc cho hành động admin.

### 7.3 Phát hiện bất thường

Alert khi: nhiều login thất bại từ một IP tới nhiều tài khoản (credential stuffing), login thành công từ quốc gia mới trong 1 giờ sau login ở quốc gia khác, một admin thực hiện > 50 hành động/giờ, truy cập audit log tăng đột biến, tỷ lệ 403 tăng bất thường (dò quyền), refresh token reuse được phát hiện, tăng vọt request tới `/admin`.

## 8. Quyền riêng tư & tuân thủ

Áp dụng Nghị định 13/2023/NĐ-CP; thiết kế tương thích GDPR cho người dùng quốc tế.

| Quyền / yêu cầu | Cách thực hiện |
|---|---|
| Thu thập tối thiểu | Chỉ trường cần cho tính năng; ngày sinh chỉ để kiểm tra tuổi; không thu thập vị trí liên tục |
| Consent | Lưu `consents[]` kèm phiên bản văn bản, thời điểm, IP. Consent marketing/analytics tách riêng, tắt được |
| Quyền truy cập & xuất | `GET /me/export` → job sinh ZIP (JSON + media), link tải hết hạn 24h, gửi email thông báo |
| Quyền sửa | Sửa được toàn bộ profile qua UI |
| Quyền xoá | Yêu cầu xoá → grace 30 ngày (huỷ được) → ẩn danh hoá: xoá PII ở `users`, đổi `handle` → `deleted_<random>`, xoá session, xoá khỏi ES, giữ nội dung công khai ở dạng "Người dùng đã xoá" (hoặc xoá luôn nếu người dùng chọn) |
| Quyền phản đối | Tắt cá nhân hoá feed, tắt dùng dữ liệu cho gợi ý |
| Lưu trữ có thời hạn | Session 30 ngày · idempotency key 24h · notification 90 ngày · log ứng dụng 90 ngày · audit log 2 năm · nội dung đã xoá 90 ngày rồi xoá cứng · hội thoại planner theo lựa chọn user (mặc định giữ) |
| Vi phạm dữ liệu | Quy trình thông báo trong 72h cho cơ quan chức năng và người bị ảnh hưởng |
| Chuyển dữ liệu quốc tế | Dữ liệu người dùng VN lưu tại region gần (Singapore hoặc VN); ghi rõ trong chính sách bảo mật danh sách bên thứ ba nhận dữ liệu (Google Gemini, Serper, Cloudflare, nhà cung cấp email/push) |

Lưu ý về dữ liệu gửi tới bên thứ ba: nội dung câu hỏi của người dùng được gửi tới Google Gemini và (khi cần) Serper. Điều này phải nêu rõ trong chính sách bảo mật và trong màn hình planner lần đầu sử dụng. Không gửi PII của người dùng trong prompt (chỉ gửi sở thích và ngôn ngữ, không gửi email/tên thật/số điện thoại).

## 9. Kiểm thử bảo mật

| Loại | Công cụ | Tần suất |
|---|---|---|
| SAST | Semgrep (ruleset `p/nodejs`, `p/python`, `p/owasp-top-ten`) | Mỗi PR |
| Dependency scan | `pnpm audit`, `pip-audit`, Trivy cho image | Mỗi PR + hàng ngày |
| Secret scan | gitleaks (pre-commit + CI) | Mỗi commit |
| IaC scan | Trivy config, Dockerfile lint (hadolint) | Mỗi PR |
| DAST | OWASP ZAP baseline scan trên staging | Hàng tuần |
| Test phân quyền | Bộ test tự động sinh request chéo giữa 2 org, 4 loại tài khoản, mọi endpoint ghi | Mỗi PR |
| Pentest bên ngoài | Đơn vị độc lập | Trước GA, sau đó hàng năm |
| Bug bounty / responsible disclosure | `security.txt` + email `security@`, cam kết phản hồi 5 ngày | Liên tục |

Ngưỡng chặn merge: không có finding `high`/`critical` từ SAST và dependency scan; test phân quyền phải xanh 100%.

## 10. Ứng phó sự cố

Phân cấp: **P1** rò rỉ dữ liệu hoặc mất kiểm soát truy cập · **P2** downtime toàn hệ thống · **P3** downtime một phần hoặc suy giảm · **P4** lỗi nhỏ.

Quy trình P1/P2: phát hiện (alert hoặc báo cáo) → tạo kênh sự cố → chỉ định incident commander → chặn/khoanh vùng (thu hồi khoá, khoá tài khoản, bật Under Attack, tắt tính năng bằng feature flag) → điều tra bằng audit log và trace → khắc phục → thông báo người bị ảnh hưởng và cơ quan chức năng nếu là rò rỉ dữ liệu cá nhân (≤72h) → postmortem không chỉ trích cá nhân trong 5 ngày làm việc, có hành động cụ thể và người phụ trách.

Chuẩn bị trước: runbook cho từng tình huống (rò rỉ khoá, DDoS, DB compromise, tài khoản admin bị chiếm) lưu ở `docs/runbooks/`; kiểm tra khả năng thu hồi toàn bộ session và luân chuyển mọi secret trong ≤30 phút, tập diễn hàng quý.

## 11. Checklist trước khi lên production

- [ ] Toàn bộ secret nằm ở secret manager, `.env` production không có trong git, `gitleaks` xanh
- [ ] TLS A+ (SSL Labs), HSTS preload đã submit, chứng chỉ tự động gia hạn có alert
- [ ] MFA bắt buộc và đã bật cho toàn bộ tài khoản có role platform
- [ ] Rate limit đã kiểm chứng bằng test tải (k6) cho từng nhóm endpoint
- [ ] Cloudflare proxy bật; firewall origin chỉ nhận IP Cloudflare (đã test chặn truy cập trực tiếp)
- [ ] Field-level encryption hoạt động; đã test giải mã sau khi luân chuyển khoá
- [ ] Backup MongoDB + Qdrant đã test restore thành công vào môi trường sạch
- [ ] Audit log không thể sửa/xoá qua user ứng dụng (đã test)
- [ ] Test phân quyền chéo org/role xanh 100%
- [ ] Pentest bên ngoài hoàn tất, mọi finding `high`+ đã xử lý hoặc có kế hoạch chấp nhận rủi ro được ký
- [ ] CSP không còn `unsafe-inline` cho script; báo cáo CSP được theo dõi
- [ ] Chính sách bảo mật, điều khoản, `security.txt` đã publish song ngữ
- [ ] Alert đã nối tới kênh trực (không chỉ email), đã test bằng sự cố mô phỏng
- [ ] Runbook và danh sách liên lạc khẩn cấp đã hoàn tất và tập diễn ít nhất một lần
