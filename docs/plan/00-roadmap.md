# PLAN-00 — Roadmap & Milestone

Giả định nhân sự: 1 tech lead · 2 backend (Node) · 1 backend AI (Python) · 2 frontend · 1 DevOps/SRE (50%) · 1 QA · 1 PO/designer (chia sẻ). Sprint 2 tuần. Tổng thời gian tới GA: **38 tuần (~9 tháng)**.

Nếu nhân sự ít hơn, giữ nguyên thứ tự phase và giãn thời gian — **không** cắt Phase 0 và Phase 6, vì đó là hai phần quyết định chất lượng của một dự án enterprise.

Tài liệu kế hoạch bổ trợ (đọc kèm file này):
- `plan/01-team-and-raci.md` — cơ cấu nhóm, ma trận RACI, phân bổ nhân sự theo phase, chuẩn ước lượng effort & Definition of Done cấp task.
- `plan/02-testing-and-quality.md` — kim tự tháp kiểm thử, ngưỡng coverage, QA gate mỗi phase, phân loại severity.
- `plan/03-risks-and-release.md` — risk register kỹ thuật, môi trường (dev/staging/prod), chiến lược nhánh & quy trình deploy/rollback.

## 1. Tổng quan phase

| Phase | Tên | Tuần | Kết quả chính |
|---|---|---|---|
| 0 | Nền tảng kỹ thuật | 1–3 | Monorepo, compose, CI/CD, auth khung, chạy được end-to-end |
| 1 | Danh tính & Portal | 4–9 | 4 loại tài khoản, RBAC, 4 portal khung, verify nhà cung cấp |
| 2 | Mạng xã hội | 10–16 | Post, feed, comment, react, follow, chat, tìm kiếm ES |
| 3 | Chat Planner & RAG | 17–24 | RAG pipeline, planner streaming, itinerary, admin KB |
| 4 | Nhà cung cấp & Admin | 25–30 | Tour, listing, availability, inquiry, admin console đầy đủ |
| 5 | Bảo mật & Chất lượng | 31–35 | Pentest, tối ưu hiệu năng, i18n hoàn thiện, a11y, observability |
| 6 | Beta & GA | 36–38 | Closed beta → open beta → GA |

## 2. Phase 0 — Nền tảng kỹ thuật (tuần 1–3)

Mục tiêu: mọi lập trình viên clone repo và chạy được toàn bộ hệ thống trong 15 phút; một request đi hết đường từ browser → api → mongodb → rag → gemini.

| Sprint | Việc |
|---|---|
| 0.1 (t1) | Monorepo pnpm + Turborepo · tsconfig/eslint/prettier dùng chung · Dockerfile 4 service · docker-compose dev · `make dev/seed/test/doctor` · MongoDB replica set init |
| 0.2 (t2) | CI pipeline (lint, typecheck, test, security scan, build) · Đăng ký/đăng nhập/refresh/logout · JWT RS256 + session collection · Zod validate + error envelope + i18n errors · logger có redactor + traceId |
| 0.3 (t3) | Khung `rag-service` FastAPI + health + service token · Qdrant collection + embed thử · Elasticsearch index + analyzer tiếng Việt (kiểm chứng tìm không dấu) · Next.js khung 4 portal + next-intl · Deploy staging tự động |

**Exit criteria** — không đạt thì không sang Phase 1:
- [ ] `git clone` → `make dev` → app chạy, ≤15 phút, không bước thủ công ngoài 2 API key
- [ ] CI xanh trên PR mẫu, chặn được PR có lỗi lint/type/secret
- [ ] Đăng ký → xác thực email → đăng nhập → gọi API có auth → refresh → logout hoạt động
- [ ] Một tài liệu mẫu ingest được vào Qdrant và truy xuất ra kết quả
- [ ] Tìm "da nang" ra "Đà Nẵng" trong Elasticsearch
- [ ] Deploy staging tự động từ nhánh `develop`
- [ ] Tài liệu `docs/` được commit và team đã đọc qua

## 3. Phase 1 — Danh tính & Portal (tuần 4–9)

| Sprint | Việc |
|---|---|
| 1.1 (t4–5) | Model User/Organization/Membership · RBAC (permission string, `ctx.require`, cache Redis 60s) · MFA TOTP + backup code · Google OAuth · quản lý session/thiết bị |
| 1.2 (t6–7) | Onboarding 4 loại tài khoản · upload giấy tờ (presign S3) · hàng đợi verify + duyệt/từ chối · context switcher · trang hồ sơ công khai 4 loại |
| 1.3 (t8–9) | Khung 4 portal với navigation và dashboard rỗng · settings đầy đủ (bảo mật, quyền riêng tư, ngôn ngữ, thông báo) · seed 63 tỉnh + 500 place · **bộ test phân quyền chéo org/role** |

**Exit criteria**:
- [ ] 4 loại tài khoản đăng ký xong vào đúng portal (AC PRD-01)
- [ ] Test phân quyền chéo xanh 100%: user org A không đọc/ghi được dữ liệu org B ở mọi endpoint
- [ ] Thu hồi membership có hiệu lực ở request kế tiếp (không chờ token hết hạn)
- [ ] MFA bắt buộc hoạt động cho role platform; refresh token reuse bị phát hiện và thu hồi family
- [ ] Verify nhà cung cấp end-to-end, có audit log đủ trường

## 4. Phase 2 — Mạng xã hội (tuần 10–16)

| Sprint | Việc |
|---|---|
| 2.1 (t10–11) | Post CRUD + presign upload · worker media (resize, WebP/AVIF, magic bytes, ClamAV, EXIF strip) · outbox → index ES · composer với draft tự lưu |
| 2.2 (t12–13) | Comment 3 tầng · reaction 6 loại · follow/block/mute · counter + job reconcile · feed 3 tab với thuật toán xếp hạng v1 + cursor pagination |
| 2.3 (t14–15) | Socket.IO gateway + Redis adapter · chat 1-1 và nhóm với `seq`, idempotency `clientMsgId`, read receipt, typing · presence · thông báo in-app + email + push (FCM) |
| 2.4 (t16) | Tìm kiếm đầy đủ (post/user/org/place) + autocomplete + facet · report + kiểm duyệt cơ bản (hàng đợi, 3 quyết định) · rate limit toàn bộ endpoint social |

**Exit criteria**:
- [ ] Toàn bộ AC của PRD-02 (AC-01…AC-10) đạt
- [ ] Bài viết index vào ES ≤3s p95; `outbox_lag_seconds` < 5 khi tải bình thường
- [ ] 20 tin nhắn gửi liên tiếp trong 2s giữ đúng thứ tự; mất mạng rồi gửi lại không tạo bản sao
- [ ] Load test: 1.000 kết nối socket đồng thời, p95 gửi→nhận ≤500ms, không rò rỉ bộ nhớ sau 30 phút
- [ ] Bài `followers`-only trả 404 với người không follow (kể cả biết URL)

## 5. Phase 3 — Chat Planner & RAG (tuần 17–24)

Phase rủi ro cao nhất. Làm song song hai luồng: `rag-service` (backend AI) và UI planner (frontend), gặp nhau ở tuần 21.

| Sprint | Việc |
|---|---|
| 3.1 (t17–18) | Ingest pipeline hoàn chỉnh (extract → clean → chunk heading-aware → embed → upsert) · hỗ trợ PDF/DOCX/MD/TXT/HTML + OCR tiếng Việt · báo tiến độ từng bước |
| 3.2 (t19–20) | Hybrid retrieval (dense + sparse + RRF) với pre-filter · reranker BGE ONNX · **bộ test vàng 200 câu + harness eval** · admin KB list/upload/chunk editor/playground |
| 3.3 (t21–22) | Orchestration: classify → rewrite → retrieve → rerank → generate · Serper · platform lookup · guardrail input/output · SSE streaming qua api · UI chat 3 cột với citation panel |
| 3.4 (t23–24) | Itinerary có cấu trúc + panel timeline + lưu `/trips` + sửa/kéo-thả + PDF + share · semantic cache · quota theo tier · feedback 👍/👎 + hàng đợi review · theo dõi chi phí |

**Exit criteria**:
- [ ] Toàn bộ AC của PRD-03 đạt
- [ ] Bộ eval: recall@5 ≥ 0.85 · faithfulness ≥ 0.90 · citation_precision ≥ 0.95 · refusal_accuracy ≥ 0.90
- [ ] Time to first token p95 ≤2s; tổng p95 ≤12s
- [ ] Prompt injection (bộ 20 mẫu) không rò rỉ system prompt lần nào
- [ ] Unpublish tài liệu → biến mất khỏi câu trả lời ≤60s
- [ ] Chi phí trung bình/hội thoại ≤0,03 USD trên tập test thực tế
- [ ] Qdrant rebuild được hoàn toàn từ `kbChunks` (đã test)

**Ứng phó nếu chậm**: cắt semantic cache và PDF export sang Phase 5, giữ nguyên eval và guardrail. Không cắt citation — không có citation thì planner mất giá trị cốt lõi.

## 6. Phase 4 — Nhà cung cấp & Admin (tuần 25–30)

| Sprint | Việc |
|---|---|
| 4.1 (t25–26) | Tour CRUD (lịch trình theo ngày, giá theo nhóm khách, departure) · Listing CRUD · availability calendar · index ES cho tour/listing + filter/facet |
| 4.2 (t27–28) | Inquiry: tạo từ planner/profile/post, hàng đợi, gán nhân sự, trạng thái, note, nối với conversation · booking request cho guide · review + phản hồi · dashboard 4 portal với biểu đồ thật |
| 4.3 (t29–30) | Admin console đầy đủ: dashboard, quản lý user + 8 hành động, hàng đợi verify, kiểm duyệt (3 tab + phím tắt + khiếu nại), Place CRUD/merge, system config + feature flag, audit log viewer, phê duyệt cấp 2, báo cáo xuất CSV |

**Exit criteria**:
- [ ] Toàn bộ AC của PRD-04 đạt
- [ ] Hành động cần phê duyệt cấp 2 không thực thi được với một admin
- [ ] Audit log không sửa/xoá được qua user ứng dụng (đã test)
- [ ] Xoá vĩnh viễn user → PII biến mất ở MongoDB và ES, script `verify-erasure` xác nhận
- [ ] Xử lý 50 item kiểm duyệt liên tiếp bằng phím tắt không lỗi

## 7. Phase 5 — Bảo mật & Chất lượng (tuần 31–35)

| Sprint | Việc |
|---|---|
| 5.1 (t31–32) | Field-level encryption + luân chuyển khoá · Cloudflare + WAF + firewall origin · 4 lớp rate limit kiểm chứng bằng k6 · CSP không `unsafe-inline` script · security header đầy đủ · SSRF/upload hardening |
| 5.2 (t33) | **Pentest bên ngoài** (2 tuần lịch, bắt đầu t32) · DAST · xử lý finding · backup + test restore MongoDB/Qdrant vào môi trường sạch |
| 5.3 (t34) | Tối ưu hiệu năng: index còn thiếu, N+1, cache tầng, LCP/CLS mobile · load test toàn hệ thống 5.000 CCU · graceful shutdown + rolling update không downtime |
| 5.4 (t35) | i18n hoàn thiện (0 key thiếu, 0 hard-code, review ngôn ngữ) · a11y WCAG AA cho luồng chính (axe + screen reader thủ công) · observability: 5 dashboard + toàn bộ alert nối kênh trực · runbook + tập diễn 1 sự cố |

**Exit criteria**: toàn bộ checklist `spec/05-security.md §11` đã tick; mọi finding pentest `high`+ đã xử lý hoặc có văn bản chấp nhận rủi ro được ký; đạt mọi ngưỡng hiệu năng ở `prd/05 §2`.

## 8. Phase 6 — Beta & GA (tuần 36–38)

| Tuần | Việc | Cổng kiểm soát |
|---|---|---|
| 36 | Closed beta: 50 traveler + 20 nhà cung cấp onboard thủ công. Nạp 100 tài liệu KB thật. Theo dõi sát, sửa lỗi hàng ngày | Không có lỗi P1/P2 mở trong 5 ngày liên tiếp |
| 37 | Open beta: mở đăng ký, giới hạn 2.000 user. Bật dần feature flag. Đo chỉ số thật vs mục tiêu | 👍 planner ≥75% · uptime ≥99,5% · p95 đạt ngưỡng |
| 38 | GA: mở hoàn toàn, công bố. Trực 24/7 tuần đầu | Điều khoản/chính sách publish · trực và escalation sẵn sàng · backup đã test |

Chuẩn bị trước beta: 100 tài liệu KB đã kiểm duyệt, 500 place có mô tả song ngữ, 20 nhà cung cấp đã verify có nội dung thật. Cold start là rủi ro R4 — không có nội dung thì beta không đo được gì.

## 9. Phụ thuộc

```
Phase 0 ──► Phase 1 ──► Phase 2 ──┬──► Phase 4 ──► Phase 5 ──► Phase 6
                        Phase 3 ──┘
```

- Phase 3 chỉ cần Phase 1 (auth + user), không cần Phase 2 → **chạy song song với Phase 2 nếu có nhân sự AI riêng**, tiết kiệm ~4 tuần.
- Phase 4 cần Phase 2 (post, ES, chat cho inquiry) và Phase 3 (planner đề xuất nhà cung cấp).
- Phase 5 cần toàn bộ tính năng xong — pentest trên hệ thống chưa đủ tính năng là lãng phí.

Phụ thuộc ngoài cần chuẩn bị trước tuần 17: tài khoản Gemini API có quota production, tài khoản Serper trả phí, tài khoản Cloudflare + domain, tài khoản email (SES/Resend) đã verify domain và ra khỏi sandbox, Firebase project cho FCM.

## 10. Rủi ro lịch trình

| # | Rủi ro | Dấu hiệu sớm | Ứng phó |
|---|---|---|---|
| S1 | Chất lượng RAG không đạt ngưỡng eval | Tuần 20 recall@5 < 0.75 | Thêm 1 tuần tinh chỉnh chunking + thử embedding khác; ngưỡng eval không hạ |
| S2 | Tài liệu KB không được nạp đủ | Tuần 30 chưa có 50 tài liệu | PO nhận trách nhiệm nạp KB từ Phase 3, không dồn vào cuối |
| S3 | Pentest ra nhiều finding nghiêm trọng | — | Đã chừa 2 tuần đệm trong Phase 5; nếu vượt thì lùi GA, không lùi pentest |
| S4 | Hiệu năng feed không đạt ở dữ liệu thật | Load test t34 p95 > 600ms | Materialize feed vào Redis theo fan-out-on-write cho user có nhiều follower |
| S5 | Chi phí LLM vượt dự toán | Chi phí/hội thoại > 0,05 USD ở beta | Siết quota tier free, tăng ngưỡng semantic cache, ưu tiên flash thay pro |
| S6 | Nhân sự AI Python là điểm đơn lẻ | — | Tech lead tham gia code review toàn bộ `apps/rag`; tài liệu spec đủ chi tiết để người khác tiếp nhận |

## 11. Sau GA (v1.5 — quý tiếp theo)

Theo thứ tự ưu tiên: thanh toán và booking trực tuyến · ứng dụng mobile native · E2EE cho tin nhắn · gọi thoại/video · affiliate/commission · mở API đối tác · mở rộng ngôn ngữ thứ ba (Hàn/Trung/Nhật theo thị trường inbound).
