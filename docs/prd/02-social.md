# PRD-02 — Luồng mạng xã hội

Liên quan: `spec/01-data-model.md`, `spec/04-search.md`, `spec/06-realtime.md`

## 1. Mục tiêu

Tạo vòng lặp nội dung tự duy trì: traveler chia sẻ trải nghiệm thật → nội dung này vừa là nguồn cảm hứng cho traveler khác, vừa là tín hiệu chất lượng cho nhà cung cấp, vừa là dữ liệu bổ sung cho planner (ở dạng tín hiệu phổ biến, không đưa vào KB).

## 2. Bài viết (Post)

### 2.1 Loại bài viết

| Loại | Mô tả | Ai đăng được |
|---|---|---|
| `story` | Bài chia sẻ trải nghiệm: text + tối đa 10 ảnh/1 video | Mọi tài khoản |
| `review` | Đánh giá có điểm sao (1–5) gắn với một Place hoặc Organization | Traveler, Guide |
| `question` | Câu hỏi cộng đồng, có thể đánh dấu câu trả lời hay nhất | Mọi tài khoản |
| `itinerary_share` | Chia sẻ lịch trình đã lưu từ planner | Traveler, Guide |
| `promotion` | Bài quảng bá tour/dịch vụ, có nhãn "Tài trợ/Quảng bá" | Agency, Business (đã verify) |

### 2.2 Thành phần bài viết

- **Nội dung**: rich text giới hạn 5.000 ký tự, hỗ trợ @mention, #hashtag, link.
- **Media**: tối đa 10 ảnh (≤10MB/ảnh) hoặc 1 video (≤200MB, ≤3 phút). Tự tạo 3 kích cỡ thumbnail, chuyển sang WebP/AVIF; video transcode HLS.
- **Địa điểm**: gắn 1 Place (từ danh mục có sẵn hoặc tạo mới chờ duyệt) + toạ độ.
- **Ngôn ngữ**: tự nhận diện (`vi`/`en`/`other`), người đăng có thể sửa. Có nút "Dịch bài này" (Gemini, cache theo cặp post+locale).
- **Quyền xem**: `public` | `followers` | `private`. Bài `promotion` bắt buộc `public`.
- **Trạng thái**: `draft` | `published` | `hidden_by_author` | `under_review` | `removed`.

### 2.3 Composer

Yêu cầu UX: upload ảnh kéo-thả với progress, gợi ý địa điểm khi nhập, gợi ý hashtag, lưu draft tự động mỗi 5 giây, xem trước trước khi đăng, cảnh báo nếu bài có link ngoài lạ.

## 3. Feed

### 3.1 Ba tab feed

| Tab | Nguồn |
|---|---|
| **Dành cho bạn** | Xếp hạng theo thuật toán (§3.2) |
| **Đang theo dõi** | Thời gian giảm dần, chỉ từ người/tổ chức đang follow |
| **Gần đây / Địa điểm** | Bài gắn địa điểm quanh vị trí hoặc điểm đến đang quan tâm |

### 3.2 Thuật toán xếp hạng v1

Điểm = tổng có trọng số, tính theo mẻ mỗi 10 phút cho tập ứng viên, sắp xếp lại lúc đọc:

```
score = 0.30 * affinity(viewer, author)      // follow, tương tác trước đó
      + 0.25 * engagement_velocity            // (react + 2*comment + 3*share) / (giờ tuổi + 2)^1.5
      + 0.20 * topical_match(viewer.interests, post.tags + post.place)
      + 0.15 * freshness                      // suy giảm hàm e, chu kỳ bán rã 36 giờ
      + 0.10 * author_quality                 // verified, trust score
      - penalty(reported, low_quality, promotion_overexposure)
```

Ràng buộc: không quá 1 bài `promotion` trong mỗi 8 bài; không quá 3 bài liên tiếp từ cùng một tác giả; bài đã xem bị hạ bậc mạnh trong 24h.

### 3.3 Phân trang

Cursor-based (`?cursor=<opaque>&limit=20`), không dùng offset. Cursor mã hoá `(score_bucket, post_id)` cho feed xếp hạng và `(created_at, post_id)` cho feed thời gian.

## 4. Tương tác

### 4.1 React

Sáu loại: `like`, `love`, `helpful`, `wow`, `been_there`, `want_to_go`. Một user một react/post, đổi được. `been_there` và `want_to_go` là tín hiệu du lịch riêng, dùng cho gợi ý và cho hồ sơ "đã đi/muốn đi".

### 4.2 Bình luận

- Đa cấp tối đa 3 tầng (post → comment → reply). Tầng sâu hơn hiển thị phẳng dưới tầng 3.
- Tối đa 2.000 ký tự, hỗ trợ 1 ảnh, @mention, react `like`/`helpful`.
- Sắp xếp: Liên quan nhất (mặc định) | Mới nhất | Cũ nhất.
- Tác giả bài viết có thể ghim 1 comment, ẩn comment trên bài của mình, và (với `question`) chọn "câu trả lời hay nhất".
- Tải theo trang: 10 comment gốc/lần, 3 reply/comment với nút "xem thêm".

### 4.3 Chia sẻ & lưu

- Chia sẻ nội bộ: repost kèm bình luận, hoặc gửi qua tin nhắn.
- Chia sẻ ngoài: link public có OG tags; bài `followers`/`private` không tạo được link ngoài.
- Bộ sưu tập (Collections): lưu bài vào bộ sưu tập tự đặt tên, đặt riêng tư hoặc công khai.

### 4.4 Follow

- Follow một chiều với User và Organization. Không cần duyệt với hồ sơ công khai; hồ sơ riêng tư cần duyệt yêu cầu.
- Chặn (block): hai bên không thấy nội dung của nhau, không nhắn tin được; huỷ follow tự động cả hai chiều.
- Ẩn (mute): không thấy bài trong feed nhưng vẫn còn follow.
- Giới hạn: 5.000 following/user để chống spam.

## 5. Nhắn tin

### 5.1 Phạm vi v1

| Tính năng | v1 |
|---|---|
| Chat 1-1 | ✅ |
| Chat nhóm (≤50 thành viên) | ✅ |
| Gửi ảnh, file (≤25MB) | ✅ |
| Trả lời một tin cụ thể (reply/quote) | ✅ |
| Trạng thái đã gửi/đã nhận/đã đọc | ✅ |
| Đang gõ (typing indicator), hiện diện online | ✅ |
| Thu hồi tin trong 5 phút, xoá phía tôi | ✅ |
| Gọi thoại/video | ❌ (v2) |
| Mã hoá đầu-cuối | ❌ v1 dùng mã hoá at-rest + TLS; E2EE đánh giá ở v2 |

### 5.2 Quy tắc ai nhắn được cho ai

- Traveler ↔ Traveler: cần follow lẫn nhau, hoặc tin nhắn đầu vào hộp "Yêu cầu tin nhắn" (message request) chờ chấp nhận.
- Traveler → Nhà cung cấp (agency/business/guide): luôn được, tin vào hàng đợi inquiry của tổ chức.
- Nhà cung cấp → Traveler: chỉ khi traveler đã liên hệ trước, hoặc traveler đang follow. Chống tiếp thị lạnh.
- Giới hạn: 20 hội thoại mới/ngày với traveler; 50 tin/phút toàn hệ thống cho mỗi user.

### 5.3 Kỹ thuật

Socket.IO trên namespace `/chat`, room theo `conversationId`. Thứ tự tin nhắn bằng số thứ tự đơn điệu tăng theo hội thoại (`seq`), không tin vào timestamp client. Tin nhắn ghi MongoDB trước khi phát tán. Chi tiết: `spec/06-realtime.md`.

## 6. Thông báo

| Loại | Kênh |
|---|---|
| React, comment, reply, mention | In-app, push (tuỳ chọn) |
| Follow mới, message request | In-app, push |
| Tin nhắn mới | In-app, push, email nếu offline >24h |
| Inquiry/booking mới (nhà cung cấp) | In-app, push, email — không tắt được |
| Kết quả kiểm duyệt, verify | In-app, email — không tắt được |
| Tổng hợp hàng tuần | Email (tuỳ chọn, mặc định bật) |

Gom nhóm (batching): "A và 12 người khác đã thích bài của bạn" trong cửa sổ 30 phút. Người dùng bật/tắt theo từng loại × từng kênh trong Cài đặt.

## 7. Địa điểm & thực thể (Place)

Danh mục địa điểm dùng chung, do admin quản trị (`prd/04-admin.md`). Post, review, itinerary đều tham chiếu Place. Trang Place tổng hợp: mô tả, ảnh, bài viết gắn thẻ, review, điểm trung bình, nhà cung cấp lân cận, "được planner đề cập N lần".

Seed dữ liệu ban đầu: 63 tỉnh/thành + ~500 điểm du lịch phổ biến, nhập từ nguồn mở có giấy phép phù hợp và chuẩn hoá thủ công.

## 8. Kiểm duyệt & chống lạm dụng

- **Báo cáo (report)**: post, comment, user, tin nhắn. Lý do: spam, sai sự thật, ngôn từ độc hại, khiêu dâm, vi phạm bản quyền, mạo danh, khác.
- **Tự động**: bộ lọc từ khoá tiếng Việt/Anh, phát hiện đăng trùng, phát hiện link độc (Google Safe Browsing), hạn mức đăng theo tuổi tài khoản.
- **Ngưỡng**: bài bị report bởi ≥3 user độc lập → `under_review`, ẩn khỏi feed cho đến khi có quyết định.
- **Trust score** người dùng (0–100): tăng theo tuổi tài khoản, verify, nội dung được đánh giá tốt; giảm theo vi phạm. Điểm thấp → hạn mức đăng thấp, bài không vào feed đề xuất.
- **Hình phạt bậc thang**: cảnh báo → giới hạn tính năng 7 ngày → treo 30 ngày → khoá vĩnh viễn. Mọi bước đều có quyền khiếu nại.
- **Rate limit** (tham khảo, chi tiết `spec/05-security.md`): tạo post 10/giờ, comment 60/giờ, react 300/giờ, follow 100/giờ.

## 9. Tìm kiếm

Elasticsearch phục vụ: tìm bài viết (full-text vi có phân tích tiếng Việt), tìm người/tổ chức, tìm địa điểm, tìm tour/listing. Filter: loại nội dung, địa điểm, khoảng thời gian, ngôn ngữ, có ảnh/không, điểm đánh giá. Gợi ý khi gõ (autocomplete) < 100ms p95. Chi tiết mapping và pipeline đồng bộ: `spec/04-search.md`.

## 10. User Stories

**Epic: Chia sẻ nội dung**
- US-01: Là một traveler vừa đi Đà Nẵng về, tôi muốn đăng bài kèm nhiều ảnh và gắn địa điểm, để chia sẻ trải nghiệm và giúp người khác. → AC-01
- US-02: Là một traveler, tôi muốn hỏi cộng đồng một câu và đánh dấu câu trả lời hay nhất, để có thông tin đáng tin trước chuyến đi. → AC-06
- US-03: Là chủ agency đã verify, tôi muốn đăng bài quảng bá tour có nhãn minh bạch, để tiếp cận khách mà không gây hiểu lầm. → AC-01

**Epic: Khám phá & feed**
- US-04: Là một traveler, tôi muốn feed "Dành cho bạn" hiển thị nội dung hợp sở thích, để tìm cảm hứng nhanh. → AC-02
- US-05: Là một traveler theo dõi vài người bạn, tôi muốn thấy bài mới của họ gần như tức thì, để không bỏ lỡ. → AC-02

**Epic: Tương tác & kết nối**
- US-06: Là một traveler, tôi muốn lưu bài hay vào bộ sưu tập theo chủ đề, để dùng khi lên kế hoạch. → (spec-01 collections)
- US-07: Là một traveler bị làm phiền, tôi muốn chặn một người và biến mất khỏi nhau hoàn toàn, để yên tâm dùng. → AC-05

**Epic: Nhắn tin**
- US-08: Là một traveler, tôi muốn nhắn tin và thấy trạng thái đã đọc/đang gõ, để trao đổi mượt như app chat quen thuộc. → AC-07
- US-09: Là một nhà cung cấp, tôi muốn không bị traveler spam tin lạnh, nhưng traveler quan tâm vẫn nhắn được, để hộp thư sạch. → §5.2

**Epic: An toàn cộng đồng**
- US-10: Là một traveler, tôi muốn báo cáo nội dung xấu và nó bị ẩn nhanh khi nhiều người cùng báo, để cộng đồng an toàn. → AC-09

## 11. Chỉ số thành công (feature-level)

| Chỉ số | Mục tiêu (sau 3 tháng GA) | Đo bằng |
|---|---|---|
| Tỷ lệ traveler đăng ≥1 bài trong 30 ngày đầu | ≥ 35% | Analytics theo cohort |
| Bài có ≥1 tương tác (react/comment) | ≥ 60% | Đếm trên posts |
| Thời gian bài của người-đang-follow tới feed | p95 ≤ 5s | Metric realtime |
| Tỷ lệ tin nhắn giao thành công (gồm offline→push) | ≥ 99,5% | deliveryReceipt |
| Retention tuần (WAU/đăng ký) social | ≥ 25% | Analytics |
| Tỷ lệ nội dung vi phạm sót lọt (post-hoc review mẫu) | ≤ 2% | Kiểm duyệt lấy mẫu |
| Autocomplete p95 | ≤ 100ms | Metric search |

## 12. Edge cases & xử lý

| Tình huống | Xử lý mong muốn |
|---|---|
| Người dùng mới, chưa follow ai, chưa có sở thích (cold start feed) | Feed "Dành cho bạn" rơi về nội dung phổ biến theo địa điểm quan tâm khai báo lúc onboarding; nếu trống hẳn thì top nội dung chất lượng toàn nền tảng theo mùa; nhắc chọn sở thích |
| Video vượt 200MB hoặc >3 phút | Chặn ở client trước upload + kiểm lại ở worker; báo lỗi rõ, gợi ý cắt ngắn |
| Upload media xong nhưng transcode/scan thất bại | Bài ở trạng thái `processing`; nếu fail, giữ text, đánh dấu media lỗi, cho đăng lại media; không mất nội dung |
| Nội dung khiêu dâm/bạo lực rõ ràng | Bộ lọc tự động + report; ẩn ngay khi đạt ngưỡng; chính sách nội dung công bố rõ; ảnh nhạy cảm có thể gắn cảnh báo trước khi xem |
| Follow bot / spam follow hàng loạt | Giới hạn 100 follow/giờ + trust score thấp → chặn; phát hiện mẫu follow-unfollow |
| Bài `promotion` xuất hiện quá dày | Ràng buộc feed: ≤1 promotion/8 bài; overexposure penalty |
| Chỉnh sửa bài sau khi đã có bản dịch cache | `contentHash` đổi → cache dịch vô hiệu, lần xem sau dịch lại |
| Chi phí lưu media tăng (video 200MB) | Chính sách retention: nén, chuyển cold storage sau N tháng nếu ít truy cập; quota media theo tài khoản; theo dõi dung lượng |
| Tin nhắn tới người đã chặn | Chặn ở tầng gửi (403), không tạo hội thoại; không rò rỉ trạng thái online |
| Xoá place đang được nhiều post tham chiếu | Không xoá cứng nếu còn tham chiếu; merge vào place khác (giữ redirect) hoặc đánh dấu ẩn, post giữ nguyên hiển thị tên |

## 13. Acceptance Criteria

- AC-01: Đăng bài kèm 10 ảnh hoàn tất < 10s trên mạng 10Mbps; ảnh hiển thị đúng ở 3 kích cỡ.
- AC-02: Bài mới của người đang follow xuất hiện ở tab Đang theo dõi trong ≤5s (không cần refresh cứng).
- AC-03: Bài viết được index vào Elasticsearch và tìm thấy trong ≤3s sau khi publish.
- AC-04: Bài `followers` không truy cập được bởi người không follow, kể cả khi biết URL trực tiếp (trả 404).
- AC-05: Chặn user → toàn bộ nội dung hai chiều biến mất khỏi feed và tìm kiếm của nhau.
- AC-06: Bình luận tầng 3 hiển thị đúng cấu trúc; reply tầng 4 hiển thị phẳng, không lỗi.
- AC-07: Tin nhắn giữ đúng thứ tự khi client gửi 20 tin liên tiếp trong 2 giây.
- AC-08: Vượt rate limit trả 429 với header `Retry-After`, không mất dữ liệu đã gửi.
- AC-09: Bài bị 3 report độc lập tự động chuyển `under_review` và biến mất khỏi mọi feed.
- AC-10: Toàn bộ thông báo có nội dung đúng theo locale của người nhận, không phải locale của người gây ra.
