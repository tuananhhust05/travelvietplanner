# PRD-01 — Tài khoản, phân quyền & Portal riêng

Liên quan: `prd/00-overview.md`, `spec/01-data-model.md`, `spec/05-security.md`

## 1. Mô hình danh tính

Nguyên tắc: **một User = một danh tính đăng nhập**. Vai trò thương mại (agency/business/guide) gắn với một **Organization** (tổ chức), User tham gia Organization qua **Membership** có role.

```
User (email/phone, credentials, MFA, locale)
 ├── accountType chính: traveler | agency | business | guide
 └── Memberships[] → Organization (type: agency | business)
                       └── role: owner | manager | staff
Guide: hồ sơ nghề nghiệp gắn trực tiếp vào User (guideProfile), có thể liên kết với agency
```

Vì sao tách Organization: một khách sạn có 5 nhân sự cùng quản lý một trang; một agency có nhiều điều hành viên. Nếu gắn tất cả vào User thì không chia sẻ quyền được, và khi nhân sự nghỉ việc không thể thu hồi.

### 1.1 Đa vai trò

- Mọi tài khoản đều mặc định có năng lực traveler (đăng bài, chat planner, nhắn tin).
- Một User có thể là member của nhiều Organization.
- Thanh chuyển ngữ cảnh (context switcher) ở header cho phép đổi giữa "Tôi (traveler)" và từng Organization.
- Hành động (đăng bài, nhắn tin) luôn thực hiện **dưới danh nghĩa ngữ cảnh đang chọn** và được ghi rõ actor trong audit log.

## 2. Vai trò & quyền (RBAC)

| Role | Cấp | Quyền chính |
|---|---|---|
| `traveler` | User | Đăng bài cá nhân, comment, react, chat planner, nhắn tin, gửi inquiry, lưu itinerary |
| `guide` | User | Toàn bộ quyền traveler + hồ sơ nghề nghiệp, lịch trống, nhận booking request, showcase tour đã dẫn |
| `org.owner` | Organization | Toàn quyền trên org, quản lý member, xoá org, đổi thông tin pháp lý |
| `org.manager` | Organization | Quản lý listing/tour, trả lời inquiry, đăng bài org, xem dashboard |
| `org.staff` | Organization | Trả lời inquiry, đăng bài (cần manager duyệt), xem dashboard hạn chế |
| `moderator` | Platform | Xem/ẩn/xoá nội dung, xử lý report, khoá tạm user |
| `kb_editor` | Platform | Quản lý knowledge base, upload tài liệu, publish/unpublish |
| `admin` | Platform | Toàn bộ moderator + kb_editor + quản lý user, verify org, cấu hình hệ thống |
| `super_admin` | Platform | Toàn bộ admin + cấp quyền admin, xem audit log đầy đủ, cấu hình bảo mật |

Quyền được biểu diễn dạng chuỗi `resource:action:scope`, ví dụ `post:delete:own`, `post:delete:any`, `org.tour:write:org`. Chi tiết ma trận đầy đủ ở `spec/05-security.md §3`.

## 3. Đăng ký & Onboarding

### 3.1 Luồng chung

1. Chọn loại tài khoản (4 card lớn, mô tả rõ "bạn là ai").
2. Đăng ký bằng email + mật khẩu, hoặc Google OAuth.
3. Xác thực email (link hết hạn 24h). Với nhà cung cấp: bắt buộc xác thực cả số điện thoại (OTP).
4. Onboarding theo loại tài khoản (§3.2–3.5).
5. Vào portal tương ứng.

### 3.2 Traveler onboarding

- Chọn ngôn ngữ, tên hiển thị, avatar (bỏ qua được).
- Chọn 3–5 sở thích du lịch (biển, núi, ẩm thực, văn hoá, phiêu lưu, nghỉ dưỡng...) → dùng để cá nhân hoá feed và ngữ cảnh cho planner.
- Chọn 3 điểm đến quan tâm.
- Có thể bỏ qua toàn bộ; hệ thống nhắc lại sau.

### 3.3 Agency onboarding

- Tên công ty, mã số thuế, địa chỉ, website, hotline.
- Upload giấy phép kinh doanh + giấy phép kinh doanh dịch vụ lữ hành (nếu có).
- Chọn khu vực hoạt động, loại tour chuyên môn.
- Trạng thái: `pending_verification` → admin duyệt → `verified`.
- Chưa verify: được đăng bài giới hạn 1 bài/ngày, không được gắn nhãn "Đã xác thực", không xuất hiện trong đề xuất của planner.

### 3.4 Business onboarding

- Loại hình: hotel / homestay / restaurant / transport / activity / other.
- Tên cơ sở, địa chỉ (chọn trên bản đồ), giờ hoạt động, khoảng giá.
- Upload giấy phép kinh doanh; với F&B thêm giấy chứng nhận an toàn thực phẩm (khuyến nghị).
- Tạo listing đầu tiên (phòng/món/dịch vụ) — có wizard hướng dẫn.
- Trạng thái verify như agency.

### 3.5 Guide onboarding

- Họ tên thật, ngày sinh, thẻ hướng dẫn viên (số thẻ, ảnh, hạn), ngôn ngữ dẫn tour, khu vực, chuyên môn.
- Giá tham khảo theo ngày, kinh nghiệm (số năm), giới thiệu bản thân.
- Trạng thái verify như trên; guide chưa verify không nhận được booking request.

## 4. Đặc tả bốn Portal

Mỗi portal là một không gian riêng: route riêng, navigation riêng, dashboard riêng. Chung design system, chung component layer.

### 4.1 Traveler Portal — `/` (app chính)

Định vị: mạng xã hội + trợ lý AI. Tham chiếu trải nghiệm: feed kiểu Instagram/Facebook kết hợp planner kiểu Notion AI.

| Vùng | Nội dung |
|---|---|
| Trang chủ `/feed` | Feed bài viết (following + gợi ý), composer, filter theo địa điểm/chủ đề |
| Planner `/planner` | Danh sách hội thoại + khung chat, panel itinerary bên phải |
| Khám phá `/explore` | Địa điểm, nhà cung cấp, guide, tour — có bản đồ và filter |
| Chuyến đi `/trips` | Itinerary đã lưu, chỉnh sửa, chia sẻ, xuất PDF |
| Tin nhắn `/messages` | Hội thoại 1-1 và nhóm |
| Hồ sơ `/u/:handle` | Bài viết, ảnh, chuyến đi công khai, người theo dõi |
| Cài đặt `/settings` | Tài khoản, bảo mật, quyền riêng tư, ngôn ngữ, thông báo |

### 4.2 Agency Portal — `/agency`

Tham chiếu: dashboard kiểu Booking Extranet / Airbnb Host.

| Trang | Nội dung |
|---|---|
| Dashboard | Lượt xem tour, inquiry mới, tỷ lệ phản hồi, engagement bài viết, biểu đồ 30 ngày |
| Tour & Package | CRUD tour: tiêu đề, lịch trình theo ngày, giá theo nhóm khách, ảnh, chính sách, mùa áp dụng |
| Inquiry / Lead | Hàng đợi yêu cầu, gán cho nhân sự, trạng thái (new/contacted/quoted/won/lost), ghi chú |
| Lịch & Chỗ trống | Ngày khởi hành, số chỗ còn |
| Nội dung | Bài viết dưới danh nghĩa agency, lịch đăng |
| Nhân sự | Mời member, đổi role, thu hồi quyền |
| Hồ sơ công ty | Thông tin, giấy tờ, trạng thái verify |

### 4.3 Business Portal — `/business`

| Trang | Nội dung |
|---|---|
| Dashboard | Lượt xem trang, inquiry, số lần được planner đề xuất, đánh giá trung bình |
| Listing | Phòng / món / dịch vụ: tên, mô tả, giá, ảnh, tiện ích, số lượng |
| Chỗ trống | Lịch dạng calendar, đóng/mở ngày, giá theo ngày (tuỳ chọn) |
| Inquiry | Như agency |
| Đánh giá | Xem và phản hồi review |
| Nội dung | Bài viết dưới danh nghĩa cơ sở |
| Nhân sự, Hồ sơ | Như agency |

### 4.4 Guide Portal — `/guide`

| Trang | Nội dung |
|---|---|
| Dashboard | Lượt xem hồ sơ, booking request, tỷ lệ nhận, thu nhập ước tính (tự nhập) |
| Hồ sơ nghề nghiệp | Ngôn ngữ, khu vực, chuyên môn, giá, chứng chỉ |
| Lịch làm việc | Đánh dấu ngày trống/đã nhận |
| Booking request | Chấp nhận / từ chối / thương lượng qua chat |
| Portfolio | Album tour đã dẫn, testimonial từ khách |
| Đánh giá | Xem và phản hồi |

### 4.5 Admin Console — `/admin`

Xem chi tiết ở `prd/04-admin.md`. Truy cập tách biệt: subdomain riêng, bắt buộc MFA, IP allowlist tuỳ chọn.

## 5. Xác thực & bảo mật tài khoản

| Cơ chế | Đặc tả |
|---|---|
| Mật khẩu | Argon2id, tối thiểu 10 ký tự, kiểm tra danh sách mật khẩu rò rỉ (k-anonymity qua HIBP) |
| Session | Access token JWT 15 phút + refresh token 30 ngày, lưu httpOnly cookie, rotation + phát hiện reuse |
| MFA | TOTP; bắt buộc với mọi role platform và org.owner; tuỳ chọn với traveler. 10 mã backup |
| OAuth | Google (v1). Bắt buộc liên kết email đã xác thực |
| Thiết bị | Danh sách session đang hoạt động, thu hồi từng thiết bị hoặc tất cả |
| Khoá tài khoản | 5 lần sai → khoá 15 phút tăng dần; thông báo email khi login từ thiết bị mới |
| Xoá tài khoản | Tự yêu cầu, chờ 30 ngày (grace period), sau đó ẩn danh hoá dữ liệu |

## 6. Verify nhà cung cấp

Trạng thái: `unverified` → `pending` → `verified` | `rejected` | `suspended`.

Quy trình: user upload giấy tờ → hệ thống OCR trích mã số thuế/số giấy phép (best-effort) → vào hàng đợi admin → admin đối chiếu → duyệt hoặc từ chối kèm lý do. SLA nội bộ: 2 ngày làm việc.

Lợi ích khi verified: nhãn xác thực, hiển thị trong kết quả tìm kiếm và đề xuất của planner, mở giới hạn đăng bài, được nhận inquiry/booking.

## 7. User Stories

Theo epic. Định dạng "Là… tôi muốn… để…". Mỗi story gắn với AC ở §8.

**Epic: Đăng ký & danh tính**
- US-01: Là một traveler, tôi muốn đăng ký nhanh bằng Google để bắt đầu dùng ngay mà không phải nhớ thêm mật khẩu. → AC-01
- US-02: Là chủ khách sạn, tôi muốn đăng ký tài khoản business và tạo listing đầu tiên có wizard hướng dẫn, để không bị lạc giữa nhiều trường nhập. → AC-01
- US-03: Là một người dùng vừa là hướng dẫn viên vừa quản lý agency, tôi muốn một lần đăng nhập chuyển được giữa các ngữ cảnh, để không phải giữ nhiều tài khoản. → AC-02

**Epic: Phân quyền & tổ chức**
- US-04: Là chủ agency, tôi muốn mời điều hành viên và phân role, để chia việc trả lời inquiry mà không chia sẻ mật khẩu. → AC-02, AC-07
- US-05: Là chủ agency, tôi muốn thu hồi quyền của nhân sự đã nghỉ ngay lập tức, để họ không còn truy cập dữ liệu công ty. → AC-07
- US-06: Là một traveler, tôi muốn chắc chắn không ai xem/sửa được dữ liệu của tổ chức mà tôi không thuộc, để yên tâm về quyền riêng tư. → AC-03

**Epic: Bảo mật tài khoản**
- US-07: Là admin nền tảng, tôi muốn bắt buộc MFA cho mọi role quản trị, để một mật khẩu lộ không đủ chiếm tài khoản. → AC-04
- US-08: Là một người dùng, tôi muốn xem và thu hồi các phiên đăng nhập trên từng thiết bị, để xử lý khi mất điện thoại. → AC-05
- US-09: Là một người dùng cẩn trọng, tôi muốn được cảnh báo email khi có đăng nhập từ thiết bị lạ, để phát hiện truy cập trái phép. → AC-05

**Epic: Verify nhà cung cấp**
- US-10: Là chủ nhà hàng mới verify, tôi muốn được gắn nhãn "Đã xác thực" và xuất hiện trong đề xuất của planner, để tiếp cận khách. → AC-06
- US-11: Là admin, tôi muốn hàng đợi verify có OCR trích sẵn mã số thuế, để duyệt nhanh và chính xác hơn. → AC-06

## 8. Edge cases & xử lý

| Tình huống | Xử lý mong muốn |
|---|---|
| OCR trích sai mã số thuế/số giấy phép | OCR chỉ là best-effort gợi ý; admin luôn thấy ảnh gốc và nhập/sửa tay; không auto-approve dựa trên OCR |
| Nhà cung cấp bị `suspended` sau khi đã `verified` | Mất nhãn xác thực, ẩn khỏi tìm kiếm/đề xuất planner, giữ dữ liệu; hiện lý do + đường khiếu nại; có thể khôi phục về `verified` |
| Hai tổ chức đăng ký trùng mã số thué | Đánh dấu nghi ngờ trùng vào hàng đợi admin (không chặn cứng vì chi nhánh có thể dùng chung); admin quyết định gộp/từ chối |
| Handle/tên tổ chức trùng | Handle unique bắt buộc (gợi ý biến thể còn trống); tên hiển thị cho phép trùng nhưng cảnh báo và hiện thông tin phân biệt (địa chỉ, verify) |
| Owner duy nhất của org rời đi/xoá tài khoản | Chặn xoá cho tới khi chuyển quyền owner cho member khác; nếu không còn member, org chuyển `suspended` chờ xử lý |
| User trong ngữ cảnh org nhưng bị thu hồi giữa phiên | Request kế tiếp trả 403 (cache quyền TTL 60s + purge khi revoke); context switcher tự ẩn org đó |
| Đăng ký OAuth với email đã tồn tại (đăng ký thường) | Đề nghị liên kết tài khoản sau khi xác thực chủ sở hữu email, không tạo tài khoản trùng |
| Grace period xoá 30 ngày rồi user đăng nhập lại | Cho phép huỷ yêu cầu xoá, khôi phục nguyên trạng nếu chưa qua mốc ẩn danh hoá |

## 9. Tiêu chí hoàn thành (Acceptance Criteria)

- AC-01: Đăng ký thành công cho cả 4 loại tài khoản, mỗi loại điều hướng đúng portal của mình.
- AC-02: User thuộc 2 Organization có thể chuyển ngữ cảnh và bài viết được gán đúng chủ thể.
- AC-03: Truy cập route của portal không thuộc quyền trả về 403, không leak dữ liệu.
- AC-04: Bật MFA, đăng nhập lại yêu cầu TOTP; mã backup dùng được một lần.
- AC-05: Refresh token đã dùng lại bị phát hiện → thu hồi toàn bộ session của user.
- AC-06: Org chưa verify không xuất hiện trong đề xuất của planner (kiểm tra bằng truy vấn thực tế).
- AC-07: Thu hồi member khỏi org → mất quyền ngay ở request tiếp theo (không chờ token hết hạn).
- AC-08: Toàn bộ nhãn UI của 4 portal có bản vi và en, không còn chuỗi hard-code.
