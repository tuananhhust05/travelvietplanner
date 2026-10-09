# PLAN-02 — Chiến lược kiểm thử & QA Gate

Bổ sung cho `plan/00-roadmap.md`. Định nghĩa cách kiểm thử xuyên suốt và cổng chất lượng chặn giữa các phase.

## 1. Kim tự tháp kiểm thử

| Tầng | Phạm vi | Công cụ | Chạy khi |
|---|---|---|---|
| Unit | Hàm/logic thuần (ranking, guardrail, format i18n, permission check) | Vitest (Node), pytest (Python) | Mỗi commit (CI) |
| Integration | Endpoint chạm DB/Redis/ES/Qdrant thật qua **testcontainers**, không mock hạ tầng | Vitest + testcontainers, pytest + testcontainers | Mỗi PR |
| Contract | api ↔ rag (schema request/response), api ↔ web (OpenAPI) | zod-to-openapi diff, schemathesis | Mỗi PR |
| E2E | Luồng người dùng qua UI thật trên staging | Playwright | Nightly + trước release |
| Load/Perf | Throughput, độ trễ, rò rỉ bộ nhớ | k6 (HTTP), artillery (socket) | Mỗi phase + P5 |
| Security | SAST, DAST, dependency, secret | Semgrep, Trivy, gitleaks, OWASP ZAP | Mỗi PR (SAST) + P5 (DAST/pentest) |
| Eval (RAG) | Chất lượng trả lời trên bộ vàng 200 câu | Harness riêng (`apps/rag/eval`) | Mỗi thay đổi retrieval/prompt |

**Nguyên tắc quan trọng**: integration test **chạm DB thật** (testcontainers), không mock MongoDB/ES/Qdrant. Mock DB dễ pass nhưng giấu lỗi migration/index/aggregation thật — đây là lớp bắt lỗi cốt lõi cho một app data-heavy.

## 2. Ngưỡng coverage

| Vùng code | Ngưỡng dòng | Ngưỡng nhánh | Ghi chú |
|---|---|---|---|
| Auth, RBAC, security (`api/auth`, `api/middleware`) | 90% | 85% | Vùng nhạy cảm, ngưỡng cao |
| RAG guardrail + citation (`rag/guardrail`) | 90% | 85% | Sai là rò rỉ/hallucination |
| Business logic chung (api/worker) | 80% | 75% | |
| UI component | 70% | — | E2E bù cho luồng tích hợp |
| Toàn dự án (gate CI) | **≥ 70% dòng, ≥ 85% cho diff mới** | | Khớp `spec/08 §CI` |

CI chặn merge nếu coverage tổng tụt dưới 70% hoặc coverage của **dòng thay đổi trong PR** dưới 85%.

## 3. QA Gate mỗi phase

Mỗi phase có một cổng QA phải xanh trước khi sang phase sau. Đây là lớp bổ sung trên exit criteria của roadmap (roadmap = "tính năng xong", QA gate = "chất lượng đủ").

| Gate | Nội dung bắt buộc | Chủ (A) |
|---|---|---|
| G0 (sau P0) | CI đủ 6 bước xanh; testcontainers chạy được trong CI; smoke test e2e đăng nhập | QA + OPS |
| G1 (sau P1) | Bộ test phân quyền chéo org/role 100% xanh; test thu hồi membership; test MFA/refresh-reuse | QA |
| G2 (sau P2) | E2E social (đăng bài→feed→comment→chat); load test socket 1.000 CCU đạt; outbox lag < 5s | QA |
| G3 (sau P3) | Eval đạt ngưỡng (recall@5 ≥0.85, faithfulness ≥0.90, citation_precision ≥0.95, refusal ≥0.90); 20 mẫu injection không rò rỉ; unpublish→biến mất ≤60s | QA + AI |
| G4 (sau P4) | E2E supplier+admin; phê duyệt cấp 2 không vượt được với 1 admin; audit log bất biến; verify-erasure sạch | QA |
| G5 (sau P5) | Pentest: mọi finding high+ đã xử lý/ký chấp nhận; load test 5.000 CCU đạt ngưỡng p95; a11y axe 0 lỗi nghiêm trọng luồng chính; DR restore đã diễn tập | QA + TL + OPS |
| G6 (GA) | Cổng beta trong roadmap §8 đã đạt; backup đã test restore; runbook + escalation sẵn sàng | TL + PO |

Gate không đạt → **không sang phase sau**; nợ kỹ thuật ghi vào backlog với nhãn `quality-debt` và ngày hẹn xử lý, không im lặng bỏ qua.

## 4. Phân loại mức độ lỗi (severity) & SLA

| Mức | Định nghĩa | SLA xử lý | Chặn release? |
|---|---|---|---|
| P1 Critical | Mất dữ liệu, rò rỉ bảo mật, hệ thống sập, PII lộ | Ngay lập tức, dừng việc khác | Có |
| P2 Major | Chức năng chính hỏng, không có cách vòng | ≤ 2 ngày | Có |
| P3 Minor | Lỗi có cách vòng, ảnh hưởng hạn chế | Sprint kế | Không |
| P4 Trivial | UI/văn bản nhỏ, không ảnh hưởng chức năng | Backlog | Không |

Cổng beta (roadmap §8): "không P1/P2 mở trong 5 ngày liên tiếp" dùng đúng phân loại này.

## 5. Kiểm thử chuyên biệt

- **i18n**: `pnpm i18n:check` (0 key thiếu, 0 hard-code, placeholder khớp); visual regression 2 locale (bắt overflow, xem spec-07 AC-11).
- **Realtime**: test thứ tự seq, idempotency clientMsgId, lấp gap sau reconnect, offline delivery (spec-06 §4).
- **Search**: test tìm không dấu ("da nang"↔"Đà Nẵng"), NFC normalization, outbox sync lag, rebuild từ Mongo.
- **RAG eval**: bộ vàng 200 câu (100 vi + 100 en, gồm ca chéo ngôn ngữ); chạy trong CI khi đụng `apps/rag`, chặn nếu tụt dưới ngưỡng.
- **Chaos nhẹ (P5)**: tắt từng phụ thuộc (Qdrant/ES/Gemini/Serper) → xác nhận graceful degradation trả `meta.degraded` chứ không 500.

## 6. Môi trường test dữ liệu

- Seed cố định (`make seed`): 63 tỉnh + 500 place, tài khoản mẫu mỗi loại, 100 tài liệu KB mẫu, post/tour/listing mẫu — để test lặp lại được.
- Không dùng dữ liệu production thật trong test/dev; nếu cần, phải ẩn danh hoá PII trước.
