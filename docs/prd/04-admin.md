# PRD-04 — Admin Console

Liên quan: `prd/01-accounts-and-portals.md`, `prd/03-chat-planner.md`, `spec/05-security.md`

## 1. Nguyên tắc

Admin Console tách biệt khỏi ứng dụng người dùng: subdomain riêng (`admin.travelvietplaner.com`), bắt buộc MFA, session ngắn (8 giờ), IP allowlist tuỳ chọn, và **mọi hành động ghi audit log không thể sửa**. Không có backdoor: admin không xem được nội dung tin nhắn riêng tư trừ khi có report cụ thể, và khi xem thì sự việc được ghi log kèm lý do.

## 2. Trang tổng quan (Dashboard)

Thẻ chỉ số realtime: user mới hôm nay theo loại, tổng MAU, post mới, hàng đợi kiểm duyệt (số item + tuổi item cũ nhất), hàng đợi verify, số hội thoại planner, chi phí LLM hôm nay, tình trạng hệ thống (API, MongoDB, Elasticsearch, Qdrant, RAG service).

Biểu đồ 30 ngày: tăng trưởng user, engagement, lượng truy vấn planner, tỷ lệ 👍/👎.

Cảnh báo hiển thị nổi: item kiểm duyệt quá SLA 4h, tài liệu KB sắp hết hiệu lực, chi phí LLM vượt 80% ngân sách ngày, tỷ lệ lỗi API > 1%.

## 3. Quản lý người dùng

### 3.1 Danh sách & tìm kiếm

Bảng có filter: loại tài khoản, trạng thái (active/pending/suspended/deleted), trạng thái verify, ngày tạo, quốc gia, trust score. Tìm theo email, số điện thoại, handle, tên, ID. Xuất CSV (có ghi log ai xuất, khi nào, bao nhiêu dòng).

### 3.2 Trang chi tiết user

Thông tin cơ bản, lịch sử đăng nhập (IP, thiết bị, thời điểm), danh sách organization, thống kê nội dung, lịch sử vi phạm, lịch sử khiếu nại, hạn mức đang áp dụng, ghi chú nội bộ (chỉ admin thấy).

### 3.3 Hành động trên user

| Hành động | Yêu cầu | Ghi chú |
|---|---|---|
| Gửi cảnh báo | Lý do | User nhận thông báo in-app + email |
| Giới hạn tính năng (7/30 ngày) | Lý do + chọn tính năng | Đăng bài / comment / nhắn tin / planner |
| Treo tài khoản | Lý do + thời hạn | User đăng nhập được nhưng chỉ thấy thông báo |
| Khoá vĩnh viễn | Lý do + phê duyệt cấp 2 (super_admin) | Không thể tự khôi phục |
| Thu hồi toàn bộ session | — | Buộc đăng nhập lại mọi thiết bị |
| Reset MFA | Xác minh danh tính ngoài luồng | Ghi log bắt buộc |
| Điều chỉnh trust score | Lý do | Giới hạn ±20 mỗi lần |
| Ẩn danh hoá & xoá dữ liệu | Yêu cầu từ user hoặc pháp lý | Không thể hoàn tác, cần phê duyệt cấp 2 |

### 3.4 Phân quyền nội bộ

Chỉ `super_admin` cấp/thu hồi role platform. Mỗi lần cấp quyền yêu cầu lý do và tự động hết hạn sau 180 ngày nếu không gia hạn (chống tích tụ quyền).

## 4. Hàng đợi verify nhà cung cấp

Danh sách yêu cầu chờ duyệt, sắp theo thời gian gửi. Mỗi item: thông tin tổ chức, ảnh giấy tờ (xem trong viewer có watermark, chặn tải trực tiếp trừ khi cần), dữ liệu OCR trích được, kết quả đối chiếu tự động (mã số thuế có định dạng hợp lệ, tên trùng khớp), lịch sử nếu từng bị từ chối.

Hành động: Duyệt · Từ chối (chọn lý do mẫu + ghi chú, user sửa và gửi lại được) · Yêu cầu bổ sung · Chuyển cho admin khác.

SLA: 2 ngày làm việc. Item quá hạn được đánh dấu đỏ và tính vào chỉ số vận hành.

## 5. Kiểm duyệt nội dung

### 5.1 Hàng đợi

Ba tab: **Bị báo cáo** (report từ user, sắp theo số report × trust score người báo) · **Tự động gắn cờ** (bộ lọc phát hiện) · **Đã xử lý** (lịch sử, tra được).

Mỗi item hiển thị: nội dung đầy đủ, ngữ cảnh xung quanh (bài gốc nếu là comment), tác giả kèm lịch sử vi phạm, danh sách lý do report, điểm tin cậy của bộ lọc tự động.

Hành động nhanh bằng bàn phím (A = approve, H = hide, R = remove, E = escalate) để xử lý nhanh khối lượng lớn.

### 5.2 Quyết định

| Quyết định | Hiệu ứng |
|---|---|
| Giữ nguyên | Nội dung trở lại bình thường, người báo cáo được thông báo chung |
| Ẩn khỏi feed | Còn truy cập qua link trực tiếp, không phân phối |
| Xoá | Ẩn với mọi người, tác giả nhận lý do, tính là vi phạm |
| Xoá + xử lý user | Xoá nội dung và áp hình phạt (§3.3) |
| Chuyển cấp cao | Vào hàng đợi admin cấp trên (nội dung nhạy cảm, pháp lý) |

Mọi quyết định đều cho phép tác giả khiếu nại một lần; khiếu nại vào hàng đợi riêng, phải do admin khác xử lý (không phải người ra quyết định đầu).

### 5.3 Cấu hình bộ lọc

Quản lý danh sách từ khoá cấm/cảnh báo theo ngôn ngữ, danh sách domain chặn, ngưỡng tự động chuyển `under_review`, hạn mức đăng theo tuổi tài khoản. Thay đổi có hiệu lực ngay và được ghi log.

## 6. Quản lý Knowledge Base

Đây là màn hình quan trọng nhất cho chất lượng planner.

### 6.1 Danh sách tài liệu

Bảng: tiêu đề, loại, ngôn ngữ, vùng áp dụng, chủ đề, độ tin cậy, trạng thái (`draft` / `processing` / `published` / `unpublished` / `failed` / `expired`), số chunk, ngày hiệu lực, ngày hết hiệu lực, số lần được truy xuất 30 ngày, ngày cập nhật, người cập nhật.

Filter theo mọi cột; tìm full-text trong nội dung tài liệu.

### 6.2 Nạp tài liệu

- Định dạng: PDF, DOCX, Markdown, TXT, HTML, CSV; hoặc nhập trực tiếp bằng editor; hoặc nhập từ URL (tải nội dung một lần, không crawl định kỳ ở v1).
- Upload nhiều file cùng lúc (tối đa 20 file, 50MB/file).
- Bắt buộc điền metadata trước khi xử lý: ngôn ngữ, vùng, chủ đề, nguồn, độ tin cậy, ngày hiệu lực.
- Sau upload: trạng thái `processing`, hiển thị tiến độ từng bước (trích văn bản → chuẩn hoá → chia chunk → embed → lưu Qdrant). Nếu lỗi, hiện lý do cụ thể và cho retry.

### 6.3 Xem & sửa chunk

Xem danh sách chunk của tài liệu với nội dung, số token, vị trí. Cho phép: sửa nội dung chunk (re-embed tự động), gộp/tách chunk, xoá chunk rác (mục lục, header/footer, trang trắng), gắn thẻ bổ sung cho chunk.

Điều này quan trọng vì chất lượng chunk quyết định chất lượng câu trả lời, và tài liệu thực tế luôn có rác.

### 6.4 Kiểm thử truy xuất (Playground)

Nhập câu hỏi thử → xem top-K chunk được truy xuất kèm điểm số (dense, sparse, sau rerank) → xem prompt cuối cùng gửi tới LLM → xem câu trả lời. Dùng để chẩn đoán khi câu trả lời sai: lỗi ở retrieval hay ở generation.

So sánh A/B: chạy cùng câu hỏi với hai cấu hình (top-K, ngưỡng, có/không rerank) và xem cạnh nhau.

### 6.5 Publish & phiên bản

Tài liệu chỉ được truy xuất khi `published`. Unpublish có hiệu lực trong ≤60s. Mỗi lần cập nhật nội dung tạo phiên bản mới, giữ 10 phiên bản gần nhất, xem diff và rollback được.

Cảnh báo tự động: tài liệu hết hiệu lực trong 30 ngày, tài liệu không được truy xuất lần nào trong 90 ngày (có thể là nội dung sai chủ đề hoặc chunk kém).

### 6.6 Phản hồi từ người dùng

Hàng đợi các câu trả lời bị 👎, kèm câu hỏi, câu trả lời, chunk đã dùng, lý do người dùng chọn. Admin gắn nhãn nguyên nhân (thiếu tài liệu / chunk sai / model diễn giải sai / câu hỏi ngoài phạm vi) và tạo việc cần làm (bổ sung tài liệu, sửa chunk, điều chỉnh prompt). Đây là vòng lặp cải tiến chính của planner.

## 7. Quản lý danh mục Place

CRUD địa điểm: tên (vi/en), loại (tỉnh/thành, quận/huyện, điểm tham quan, bãi biển, núi, khu bảo tồn...), toạ độ, mô tả song ngữ, ảnh, địa điểm cha, alias (tên gọi khác để tìm kiếm). Duyệt Place do user đề xuất, gộp Place trùng (merge, tự động trỏ lại mọi tham chiếu).

## 8. Cấu hình hệ thống

| Nhóm | Mục cấu hình |
|---|---|
| AI | Model đang dùng, temperature, top-K, ngưỡng similarity, bật/tắt web search, quota theo tier, ngân sách chi phí/ngày |
| Feature flag | Bật/tắt tính năng theo % user hoặc theo nhóm (rollout dần) |
| Rate limit | Hạn mức theo endpoint và theo role |
| Nội dung | Danh sách từ khoá, domain, ngưỡng kiểm duyệt |
| Thông báo | Mẫu email/push song ngữ, có preview |
| Bảo trì | Bật chế độ bảo trì, thông báo hiển thị cho user |

Mọi thay đổi cấu hình yêu cầu ghi lý do; thay đổi thuộc nhóm AI và Bảo mật cần phê duyệt cấp 2.

## 9. Audit log & báo cáo

Audit log ghi: thời điểm, actor (user id + email), IP, hành động, đối tượng, giá trị trước/sau, lý do. Chỉ ghi thêm (append-only), không API sửa/xoá, lưu tối thiểu 2 năm. Tìm theo actor, đối tượng, loại hành động, khoảng thời gian.

Báo cáo định kỳ xuất được: tăng trưởng user, hoạt động kiểm duyệt (số item, thời gian xử lý, tỷ lệ theo quyết định), hiệu quả planner, chi phí hạ tầng và LLM.

## 10. User Stories

**Epic: Quản trị người dùng & an toàn**
- US-01: Là moderator, tôi muốn xử lý hàng đợi report bằng phím tắt, để giải quyết khối lượng lớn nhanh mà không mỏi tay. → AC-10
- US-02: Là admin, tôi muốn áp hình phạt bậc thang có ghi lý do, để xử lý vi phạm công bằng và có dấu vết. → AC-03
- US-03: Là super_admin, tôi muốn hành động nhạy cảm (khoá vĩnh viễn, xoá dữ liệu) cần hai người phê duyệt, để tránh lạm quyền hoặc thao tác nhầm. → AC-07

**Epic: Verify nhà cung cấp**
- US-04: Là admin, tôi muốn xem ảnh giấy tờ có watermark cùng dữ liệu OCR đối chiếu, để duyệt verify nhanh và an toàn. → AC-03

**Epic: Chất lượng Knowledge Base**
- US-05: Là kb_editor, tôi muốn nạp tài liệu và thấy tiến độ từng bước, để biết khi nào sẵn sàng và lỗi ở đâu. → AC-04
- US-06: Là kb_editor, tôi muốn sửa/xoá chunk rác và re-embed tự động, để nâng chất lượng câu trả lời planner. → AC-06
- US-07: Là kb_editor, tôi muốn thử câu hỏi trong playground và xem chunk + prompt + trả lời, để chẩn đoán lỗi ở retrieval hay generation. → AC-05
- US-08: Là kb_editor, tôi muốn unpublish tài liệu sai và nó biến mất khỏi planner ngay, để không phát tán thông tin lỗi. → AC-05
- US-09: Là kb_editor, tôi muốn xem hàng đợi câu trả lời bị 👎 kèm nguyên nhân, để đóng vòng lặp cải tiến planner. → AC-06

**Epic: Vận hành & minh bạch**
- US-10: Là admin, tôi muốn mọi hành động quản trị được ghi audit log bất biến, để truy vết và tuân thủ. → AC-03
- US-11: Là admin, tôi muốn cấu hình chi phí LLM/ngày và được cảnh báo khi vượt 80%, để kiểm soát ngân sách. → §2, §8

## 11. Chỉ số thành công (feature-level)

| Chỉ số | Mục tiêu | Đo bằng |
|---|---|---|
| Thời gian xử lý item kiểm duyệt (trung vị) | ≤ 4h trong giờ làm việc | Timestamp hàng đợi |
| Tỷ lệ verify xử lý trong SLA 2 ngày | ≥ 95% | Hàng đợi verify |
| Tỷ lệ quyết định kiểm duyệt bị lật khi khiếu nại | ≤ 10% | So quyết định đầu vs khiếu nại |
| Thời gian unpublish KB có hiệu lực | ≤ 60s | Đo end-to-end |
| Tỷ lệ tài liệu KB không được truy xuất trong 90 ngày | Theo dõi, giảm dần | stats.retrievalCount |
| Độ phủ audit: hành động nhạy cảm có log đủ trường | 100% | Kiểm thử tự động |

## 12. Edge cases & xử lý

| Tình huống | Xử lý mong muốn |
|---|---|
| Chỉ có 1 admin trực nhưng hành động cần phê duyệt cấp 2 | Yêu cầu ở trạng thái `pending_approval` 24h; nếu quá hạn, hết hiệu lực và phải tạo lại; không có đường tự phê duyệt |
| OCR trích sai dữ liệu verify | OCR chỉ gợi ý; admin đối chiếu ảnh gốc, nhập tay; quyết định dựa trên con người |
| Người khiếu nại gặp lại chính admin ra quyết định đầu | Hệ thống định tuyến khiếu nại sang admin khác; nếu chỉ 1 admin đủ quyền, chuyển cấp super_admin |
| Ingest KB thất bại giữa chừng (OCR/embed lỗi) | Trạng thái `failed` + lý do cụ thể theo bước; retry từ bước lỗi; không để tài liệu treo `processing` vô hạn (timeout) |
| Sửa chunk trong khi tài liệu đang được truy xuất | Re-embed + upsert idempotent; purge semantic cache liên quan; thay đổi có hiệu lực ≤60s |
| Xoá tài khoản có nội dung được người khác tham chiếu (mention) | Ẩn danh hoá tác giả, giữ nội dung của người khác; cập nhật mention thành "người dùng đã xoá" |
| Admin xem tin nhắn riêng tư (chỉ khi có report) | Bắt buộc nhập lý do; ghi audit log kèm phạm vi xem; không có đường xem hàng loạt |
| Cấu hình AI/Bảo mật bị đổi nhầm gây sự cố | Cần phê duyệt cấp 2 + ghi lý do; `systemConfig` giữ lịch sử để rollback nhanh |
| Xuất CSV khối lượng lớn dữ liệu người dùng | Ghi log ai xuất/khi nào/bao nhiêu dòng; giới hạn tần suất; cân nhắc ẩn danh trường nhạy cảm |

## 13. Acceptance Criteria

- AC-01: Truy cập bất kỳ route `/admin` mà không có role platform → 403, có ghi log lần thử.
- AC-02: Admin chưa bật MFA không đăng nhập được vào console (bị buộc thiết lập MFA).
- AC-03: Mọi hành động ở §3.3, §5.2, §6.5, §8 đều xuất hiện trong audit log với đủ trường bắt buộc.
- AC-04: Upload PDF 30 trang → hoàn tất pipeline < 90s, số chunk và preview hiển thị đúng.
- AC-05: Unpublish tài liệu → playground và planner thật không còn truy xuất chunk đó trong ≤60s.
- AC-06: Sửa nội dung một chunk → embedding được cập nhật, kết quả truy xuất phản ánh nội dung mới.
- AC-07: Hành động cần phê duyệt cấp 2 không thực thi được với một admin duy nhất.
- AC-08: Xoá vĩnh viễn user → dữ liệu cá nhân được ẩn danh hoá ở MongoDB và Elasticsearch, kiểm tra được bằng truy vấn.
- AC-09: Toàn bộ UI console có bản vi và en.
- AC-10: Xử lý 50 item kiểm duyệt liên tiếp bằng phím tắt không lỗi, không mất trạng thái hàng đợi.
