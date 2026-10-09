# PRD-00 — Tổng quan sản phẩm TravelVietPlanner

| Thuộc tính | Giá trị |
|---|---|
| Sản phẩm | travelvietplaner.com |
| Phiên bản tài liệu | 1.0 |
| Ngày | 2026-08-03 |
| Trạng thái | Draft for review |
| Chủ sở hữu | Product Owner |
| Tài liệu liên quan | `spec/00-architecture.md`, `plan/00-roadmap.md` |

## 1. Vision

TravelVietPlanner là nền tảng du lịch Việt Nam kết hợp **mạng xã hội du lịch** và **AI travel planner**, nơi bốn nhóm người dùng (traveler, agency, business, guide) gặp nhau trong cùng một hệ sinh thái: người đi du lịch tìm cảm hứng và lên kế hoạch bằng AI, các đơn vị cung cấp dịch vụ tiếp cận đúng nhu cầu tại đúng thời điểm.

Khác biệt cốt lõi: câu trả lời của AI planner được xây trên **kho kiến thức có kiểm duyệt** (tài liệu do admin nạp qua RAG) cộng với **dữ liệu web thời gian thực** (Serper), chứ không phải chỉ suy đoán từ LLM. Điều này cho độ chính xác và khả năng truy nguồn (citation) mà chatbot du lịch thông thường không có.

## 2. Mục tiêu kinh doanh & OKR năm đầu

| # | Mục tiêu | Chỉ số (KR) | Mốc 12 tháng |
|---|---|---|---|
| G1 | Xây tập người dùng traveler | MAU traveler | 50.000 |
| G2 | Thu hút nhà cung cấp | Business + agency đã verify | 1.000 |
| G3 | AI planner trở thành lý do quay lại | % MAU dùng planner ≥1 lần/tháng | ≥ 40% |
| G4 | Chất lượng câu trả lời | Tỷ lệ phản hồi 👍 trên câu trả lời planner | ≥ 80% |
| G5 | Nội dung do người dùng tạo | Bài post mới/tháng | 20.000 |
| G6 | Nền tảng vận hành ổn định | Uptime API cốt lõi | ≥ 99.9% |

## 3. Phạm vi (Scope)

### 3.1 Trong phạm vi v1.0

- Bốn loại tài khoản với **portal riêng biệt**: Traveler, Agency, Business, Guide, cộng Admin Console.
- Luồng mạng xã hội: đăng bài (ảnh/video/địa điểm), feed, react, bình luận đa cấp, follow, nhắn tin 1-1 và nhóm.
- Chat Planner: hội thoại đa lượt với AI, RAG trên kho tài liệu admin, web search realtime, trích nguồn, xuất itinerary.
- Admin: quản lý user, kiểm duyệt post/comment, quản lý knowledge base, xem dashboard.
- Tìm kiếm toàn văn bằng Elasticsearch cho post, người dùng, dịch vụ, địa điểm.
- Song ngữ vi/en toàn bộ UI và nội dung hệ thống.
- Bảo mật: MFA, mã hoá at-rest/in-transit, rate limit, chống DDoS, audit log.

### 3.2 Ngoài phạm vi v1.0 (backlog)

- Thanh toán và booking trực tuyến (đặt phòng, đặt tour) — v1.5.
- Ứng dụng mobile native (v1 dùng responsive web + PWA).
- Chương trình affiliate/commission, hợp đồng điện tử.
- Livestream, story dạng ephemeral.
- Mở API công khai cho đối tác thứ ba.

## 4. Personas

| Persona | Mô tả | Nhu cầu chính | Thành công khi |
|---|---|---|---|
| **Traveler** — Minh, 27, nhân viên văn phòng HN | Đi 3–4 chuyến/năm, ngân sách vừa | Lên kế hoạch nhanh, tin được review thật | Có itinerary 3N2Đ trong <10 phút, biết chi phí ước tính |
| **Agency** — Công ty tour 15 nhân sự | Bán tour miền Trung | Đăng tour, tiếp cận traveler đang có nhu cầu, quản lý lead | Nhận ≥20 inquiry chất lượng/tháng |
| **Business** — Chủ homestay Đà Lạt | 8 phòng, tự vận hành | Có trang hiện diện, hiển thị trong câu trả lời AI, nhận tin nhắn | Tăng lượt xem trang và inquiry trực tiếp |
| **Guide** — HDV tự do, thẻ hành nghề | Nhận tour theo ngày | Xây uy tín cá nhân, hiện lịch trống, nhận job | Hồ sơ verify + booking request đều đặn |
| **Admin/Moderator** — nhân sự nội bộ | Vận hành nền tảng | Kiểm duyệt hiệu quả, nạp kiến thức, phát hiện lạm dụng | Xử lý report <4h, KB luôn cập nhật |

## 5. Bản đồ tính năng theo persona

| Nhóm tính năng | Traveler | Agency | Business | Guide | Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Đăng bài, feed, comment, react | ✅ | ✅ | ✅ | ✅ | 👁 |
| Nhắn tin | ✅ | ✅ | ✅ | ✅ | 👁 |
| Chat Planner (AI) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Trang hồ sơ công khai | ✅ | ✅ | ✅ | ✅ | — |
| Quản lý tour/package | — | ✅ | — | — | 👁 |
| Quản lý listing dịch vụ (phòng, bàn, tiện ích) | — | — | ✅ | — | 👁 |
| Lịch trống & nhận booking request | — | ✅ | ✅ | ✅ | — |
| Dashboard hiệu quả (view, lead, engagement) | ⚪ | ✅ | ✅ | ✅ | ✅ |
| Quản lý user & phân quyền | — | ⚪ team | ⚪ team | — | ✅ |
| Kiểm duyệt nội dung | — | — | — | — | ✅ |
| Quản lý knowledge base RAG | — | — | — | — | ✅ |

✅ đầy đủ · ⚪ hạn chế · 👁 chỉ xem để vận hành · — không có

## 6. Nguyên tắc sản phẩm

1. **Trust first** — mọi nội dung thương mại phải gắn với chủ thể đã verify; AI luôn trích nguồn.
2. **Một danh tính, nhiều vai** — một email có thể vừa là traveler vừa quản lý một business, nhưng ngữ cảnh portal luôn rõ ràng.
3. **Bilingual by design** — không hard-code chuỗi, không coi tiếng Việt là bản dịch phụ.
4. **AI không thay thế người** — planner đề xuất, con người quyết định; luôn có đường dẫn tới nhà cung cấp thật.
5. **Privacy by default** — thu thập tối thiểu, mặc định riêng tư ở mức chặt nhất hợp lý.

## 7. Giả định & phụ thuộc

- Google Gemini API và Serper API khả dụng thương mại, có quota đủ cho lưu lượng dự kiến.
- Có nhân sự nội bộ chuẩn hoá và nạp tài liệu kiến thức (không crawl tự động ở v1).
- Nội dung do admin nạp phải có quyền sử dụng hợp pháp.
- Verify doanh nghiệp dựa trên giấy phép kinh doanh; verify guide dựa trên thẻ hướng dẫn viên — quy trình bán tự động, có người review.
- Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân; thiết kế theo hướng tương thích GDPR cho người dùng quốc tế.

## 8. Rủi ro chính

| # | Rủi ro | Ảnh hưởng | Giảm thiểu |
|---|---|---|---|
| R1 | AI trả lời sai/hallucinate về giá, giấy tờ | Mất uy tín | RAG bắt buộc citation, guardrail chủ đề, disclaimer, thu thập feedback |
| R2 | Chi phí LLM tăng theo lưu lượng | Biên lợi nhuận | Cache semantic, giới hạn quota theo tier, cắt ngắn context, chọn model theo độ khó |
| R3 | Spam & nội dung độc hại | Trải nghiệm xấu | Rate limit, phát hiện tự động, hàng đợi kiểm duyệt, trust score |
| R4 | Ít nhà cung cấp ở giai đoạn đầu (cold start) | Nội dung mỏng | Seed dữ liệu địa điểm, onboarding thủ công 100 nhà cung cấp đầu tiên |
| R5 | Rò rỉ dữ liệu cá nhân | Pháp lý, uy tín | Mã hoá field-level, least privilege, pentest trước GA, audit log |
| R6 | DDoS / lạm dụng endpoint AI đắt tiền | Downtime, hoá đơn | WAF + Cloudflare, rate limit nhiều lớp, bắt buộc auth cho planner |

## 9. Chỉ số theo dõi (product analytics)

- **Acquisition**: signup theo loại tài khoản, tỷ lệ hoàn tất onboarding, tỷ lệ verify thành công.
- **Engagement**: DAU/MAU, post/user/tháng, comment per post, tin nhắn/hội thoại.
- **AI planner**: số hội thoại, lượt/hội thoại, tỷ lệ có citation, 👍/👎, p95 latency, cost/hội thoại.
- **Marketplace**: lượt xem hồ sơ nhà cung cấp, inquiry gửi đi, thời gian phản hồi trung bình.
- **Chất lượng vận hành**: số report, thời gian xử lý report, tỷ lệ nội dung bị xoá.

## 10. Cấu trúc bộ tài liệu

```
prd/    00-overview · 01-accounts-and-portals · 02-social · 03-chat-planner · 04-admin · 05-i18n-and-nfr
spec/   00-architecture · 01-data-model · 02-api · 03-rag-service · 04-search
        05-security · 06-realtime · 07-i18n · 08-devops
plan/   00-roadmap · 01-workstreams · 02-engineering-standards
```
