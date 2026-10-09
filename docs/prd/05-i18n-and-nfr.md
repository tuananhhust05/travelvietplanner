# PRD-05 — Song ngữ & Yêu cầu phi chức năng

Liên quan: `spec/07-i18n.md`, `spec/05-security.md`, `spec/08-devops.md`

## 1. Song ngữ (vi / en)

### 1.1 Nguyên tắc

Tiếng Việt và tiếng Anh là hai ngôn ngữ ngang hàng. `vi` là mặc định cho người dùng ở Việt Nam, `en` cho phần còn lại. Không có ngôn ngữ nào là "bản dịch phụ" — cả hai đều được review trước khi release.

Ba tầng nội dung cần xử lý khác nhau:

| Tầng | Ví dụ | Cách xử lý |
|---|---|---|
| **UI chrome** | Nút, nhãn, thông báo lỗi, email | File dịch (i18n bundle), dịch thủ công, review bởi người |
| **Nội dung hệ thống** | Mô tả Place, danh mục, chính sách, mẫu email | Trường đa ngôn ngữ trong DB (`{ vi, en }`), admin nhập cả hai |
| **Nội dung người dùng** | Post, comment, tin nhắn, review | Giữ nguyên gốc + nhận diện ngôn ngữ + nút "Dịch bài này" (Gemini, có cache) |

### 1.2 Xác định ngôn ngữ hiển thị

Thứ tự ưu tiên: tuỳ chọn đã lưu của user → cookie `locale` → header `Accept-Language` → `vi` (mặc định).

Người dùng đổi ngôn ngữ ở bất kỳ đâu qua switcher ở header/footer; lựa chọn lưu vào profile và áp dụng cho cả email, push notification, và câu trả lời của planner.

### 1.3 Yêu cầu kỹ thuật (tóm tắt, chi tiết ở spec/07)

- Không hard-code chuỗi trong code. CI có bước kiểm tra chuỗi lạ (lint rule) và chuỗi thiếu bản dịch.
- Hỗ trợ số nhiều đúng ngữ pháp (tiếng Việt không biến đổi số nhiều, tiếng Anh có) qua ICU MessageFormat.
- Định dạng ngày/giờ/tiền tệ theo locale: `vi` dùng `dd/MM/yyyy` và `1.500.000 ₫`; `en` dùng `MMM d, yyyy` và `₫1,500,000` (hoặc quy đổi USD khi bật tuỳ chọn).
- Múi giờ hiển thị theo `Asia/Ho_Chi_Minh` mặc định, cho phép đổi; **lưu trữ luôn UTC**.
- Slug URL song ngữ: `/dia-diem/da-nang` và `/places/da-nang`, có `hreflang` và canonical đúng cho SEO.
- Tìm kiếm phải hoạt động với cả tiếng Việt có dấu và không dấu ("da nang" tìm ra "Đà Nẵng").
- Email/push gửi theo locale của **người nhận**.

### 1.4 Acceptance Criteria

- AC-01: Đổi ngôn ngữ → toàn bộ UI, email và câu trả lời planner đổi theo, không còn chuỗi tiếng còn lại.
- AC-02: CI fail nếu có key thiếu bản dịch ở một trong hai ngôn ngữ.
- AC-03: Tìm "da nang", "Đà Nẵng", "ĐÀ NẴNG" cho cùng tập kết quả.
- AC-04: Người dùng `en` nhận thông báo tiếng Anh về comment của người dùng `vi`.

## 2. Hiệu năng

| Chỉ số | Mục tiêu |
|---|---|
| API đọc đơn giản (p95) | ≤ 200ms |
| API feed (p95) | ≤ 400ms |
| Tìm kiếm Elasticsearch (p95) | ≤ 300ms |
| Autocomplete (p95) | ≤ 100ms |
| Planner — token đầu tiên (p95) | ≤ 2s |
| Planner — trả lời đầy đủ (p95) | ≤ 12s |
| Tin nhắn realtime (gửi → nhận) | ≤ 500ms |
| LCP trang feed (4G, mobile) | ≤ 2,5s |
| CLS | ≤ 0,1 |
| Tải đồng thời v1 | 5.000 user hoạt động, 500 req/s đọc, 50 req/s ghi |

Nguyên tắc đạt được: cache nhiều tầng (CDN → Redis → in-process), phân trang cursor, index đầy đủ, tránh N+1 truy vấn, tách đọc/ghi khi cần, đẩy việc nặng sang queue (BullMQ), stream thay vì chờ.

## 3. Khả năng chịu tải & mở rộng

- Mọi service backend **stateless** → scale ngang bằng cách tăng replica.
- Trạng thái nằm ở MongoDB (replica set), Redis (session/cache/queue), Elasticsearch (cluster ≥3 node ở production), Qdrant (có replication), object storage (S3-compatible).
- Socket.IO dùng Redis adapter để phát tán giữa nhiều instance.
- Kiến trúc modular monolith cho backend Node ở v1 (tách module rõ ràng theo domain), có thể tách microservice sau mà không viết lại. RAG service tách riêng từ đầu vì khác ngôn ngữ và khác đặc tính tải.

## 4. Độ tin cậy

| Yêu cầu | Mục tiêu |
|---|---|
| Uptime API cốt lõi | 99,9%/tháng (≈43 phút downtime) |
| Uptime planner | 99,5% (phụ thuộc nhà cung cấp bên thứ ba) |
| RPO (mất dữ liệu tối đa) | 15 phút |
| RTO (thời gian phục hồi) | 2 giờ |
| Backup MongoDB | Snapshot hàng ngày + oplog liên tục, giữ 30 ngày, test restore hàng tháng |
| Backup Qdrant | Snapshot hàng ngày; có khả năng rebuild toàn bộ từ tài liệu gốc |
| Backup Elasticsearch | Không backup — rebuild từ MongoDB (là nguồn sự thật) |

Suy giảm có kiểm soát (graceful degradation):

| Thành phần lỗi | Hành vi hệ thống |
|---|---|
| Elasticsearch | Tìm kiếm chuyển sang truy vấn MongoDB hạn chế, hiện banner "tìm kiếm đang hạn chế" |
| Qdrant / RAG service | Planner trả lời không có KB, nói rõ đang thiếu nguồn nội bộ, hoặc tạm khoá planner |
| Gemini API | Hiện thông báo tạm thời, giữ hội thoại, cho retry; không mất tin nhắn người dùng |
| Serper | Bỏ bước web search, trả lời từ KB và ghi rõ |
| Redis | Session mất → buộc đăng nhập lại; cache miss → chậm hơn nhưng vẫn hoạt động |

## 5. Bảo mật (tóm tắt)

Chi tiết ở `spec/05-security.md`. Yêu cầu cấp sản phẩm:

- Mã hoá in-transit: TLS 1.3, HSTS, chỉ cipher mạnh. Mã hoá at-rest: volume encryption + mã hoá field-level cho dữ liệu nhạy cảm (số giấy tờ, số điện thoại, nội dung tin nhắn).
- Xác thực: Argon2id, JWT ngắn hạn + refresh rotation, MFA bắt buộc cho role đặc quyền.
- Phân quyền: kiểm tra ở tầng service, không chỉ ở route; deny by default.
- Chống DDoS: Cloudflare (L3/L4/L7) + WAF + rate limit nhiều lớp + circuit breaker cho endpoint đắt tiền.
- Chống lạm dụng đầu vào: validate schema mọi request (Zod), chống NoSQL injection, XSS (sanitize HTML), SSRF (allowlist khi fetch URL), upload an toàn (kiểm magic bytes, quét malware).
- Ghi log an toàn: không log mật khẩu, token, PII đầy đủ. Audit log append-only.
- Kiểm thử: SAST + dependency scan trong CI, DAST định kỳ, pentest bên ngoài trước GA.
- Quyền riêng tư: xuất dữ liệu cá nhân theo yêu cầu, xoá/ẩn danh hoá, quản lý consent, tuân thủ Nghị định 13/2023/NĐ-CP.

## 6. Khả năng tiếp cận (Accessibility)

Mục tiêu WCAG 2.1 mức AA cho các luồng chính: đăng ký/đăng nhập, feed, composer, planner, tìm kiếm, các portal.

- Điều hướng đầy đủ bằng bàn phím, focus indicator rõ ràng, thứ tự tab hợp lý.
- Semantic HTML + ARIA đúng chỗ; live region cho nội dung stream của planner và tin nhắn mới.
- Tương phản màu ≥ 4,5:1 với văn bản thường.
- Bắt buộc alt text cho ảnh trong composer (có gợi ý tự động, cho phép đánh dấu "ảnh trang trí").
- Tôn trọng `prefers-reduced-motion`; không dùng riêng màu để truyền tải thông tin.
- Kiểm tra tự động (axe) trong CI + kiểm tra thủ công với screen reader trước mỗi release lớn.

Lưu ý: kiểm chứng đầy đủ WCAG cần kiểm thử thủ công với công nghệ trợ giúp và review bởi chuyên gia accessibility; kiểm tra tự động chỉ phát hiện được một phần.

## 7. Khả năng quan sát (Observability)

- **Log** có cấu trúc JSON, gắn `traceId`/`requestId` xuyên suốt Node ↔ FastAPI, tập trung ở Loki hoặc OpenSearch.
- **Metric** Prometheus: RED (rate, error, duration) cho mọi endpoint; chỉ số nghiệp vụ (post/phút, hội thoại planner, chi phí token); chỉ số hạ tầng.
- **Trace** OpenTelemetry, ưu tiên phủ luồng planner (retrieval → rerank → LLM) vì đây là nơi khó chẩn đoán nhất.
- **Dashboard** Grafana: tổng quan hệ thống, chất lượng planner, chi phí, kiểm duyệt.
- **Alert**: tỷ lệ lỗi 5xx > 1% trong 5 phút, p95 latency vượt ngưỡng 2×, queue tồn đọng, chi phí LLM vượt ngân sách, node DB/ES/Qdrant unhealthy, chứng chỉ TLS sắp hết hạn.

## 8. Tuân thủ & pháp lý

- Điều khoản sử dụng, Chính sách bảo mật, Chính sách nội dung, Chính sách cookie — song ngữ, có phiên bản và lịch sử.
- Quản lý consent: chấp nhận điều khoản khi đăng ký (lưu phiên bản + thời điểm), consent riêng cho marketing và analytics.
- Quyền của chủ thể dữ liệu: xem, sửa, xuất (JSON/CSV), xoá, phản đối xử lý. SLA phản hồi 30 ngày.
- Lưu trữ dữ liệu: người dùng Việt Nam lưu tại region Singapore hoặc Việt Nam (đánh giá theo yêu cầu lưu trữ dữ liệu trong nước tại thời điểm triển khai).
- Nội dung tài liệu trong KB phải có nguồn hợp pháp; ghi rõ nguồn khi trích dẫn.
- Tuổi tối thiểu 16; có cơ chế báo cáo tài khoản dưới tuổi.

## 9. Trình duyệt & thiết bị hỗ trợ

Chrome/Edge 2 phiên bản gần nhất, Safari 16+, Firefox ESR trở lên, Chrome Android, Safari iOS 16+. Thiết kế mobile-first (>70% traffic dự kiến từ mobile). PWA: cài được, cache shell, xem lại nội dung đã tải khi offline (không hỗ trợ đăng bài offline ở v1).
