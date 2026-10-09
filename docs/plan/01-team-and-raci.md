# PLAN-01 — Cơ cấu nhóm, vai trò & RACI

Bổ sung cho `plan/00-roadmap.md`. Roadmap trả lời "làm gì, khi nào"; file này trả lời "ai làm, ai chịu trách nhiệm, ước lượng bao nhiêu".

## 1. Cơ cấu nhóm & vai trò

| Vai trò | Ký hiệu | Số lượng | Trách nhiệm chính |
|---|---|---|---|
| Tech Lead | TL | 1 | Kiến trúc, review toàn bộ PR, quyết định kỹ thuật, chủ ADR, người gỡ nút thắt |
| Backend Node | BE | 2 | `apps/api`, `apps/worker`: auth, social, chat, admin, outbox |
| Backend AI (Python) | AI | 1 | `apps/rag`: ingest, retrieval, orchestration, eval |
| Frontend | FE | 2 | `apps/web`: 4 portal, planner UI, admin console, i18n |
| DevOps/SRE (50%) | OPS | 0.5 | Compose, CI/CD, observability, backup, TLS, Cloudflare |
| QA | QA | 1 | Test plan, e2e, load test, quản lý QA gate mỗi phase |
| PO/Designer (chia sẻ) | PO | 1 | Backlog, ưu tiên, nội dung KB/seed, nghiệm thu AC |

**Điểm đơn lẻ (single point of failure)**: AI chỉ có 1 người (rủi ro S6). Biện pháp: TL review toàn bộ `apps/rag`, cặp đôi (pairing) ở Phase 3.2–3.3, spec đủ chi tiết để người khác tiếp nhận.

## 2. Ma trận RACI theo phase

R = Responsible (làm) · A = Accountable (chịu trách nhiệm cuối, chỉ 1 người) · C = Consulted · I = Informed

| Phase / Hạng mục | TL | BE | AI | FE | OPS | QA | PO |
|---|---|---|---|---|---|---|---|
| P0 Monorepo + Compose + CI | A | R | C | C | R | I | I |
| P0 Auth khung (JWT/session) | A | R | I | C | I | C | I |
| P1 RBAC + Membership | A | R | I | C | I | C | C |
| P1 Onboarding + Verify | C | R | I | R | I | C | A |
| P1 4 Portal khung | C | C | I | R | I | I | A |
| P2 Post/Feed/Comment | C | R | I | R | I | C | A |
| P2 Realtime chat | A | R | I | R | C | C | I |
| P2 Search (ES) | A | R | I | C | C | C | I |
| P3 RAG ingest + retrieval | C | C | R | I | C | C | I |
| P3 Orchestration + guardrail | A | C | R | C | I | C | C |
| P3 Planner UI + citation | C | I | C | R | I | C | A |
| P3 Eval harness (bộ vàng) | C | I | R | I | I | A | C |
| P4 Tour/Listing/Inquiry | C | R | I | R | I | C | A |
| P4 Admin console | C | R | I | R | I | C | A |
| P5 Bảo mật + pentest | A | R | C | C | R | C | I |
| P5 Hiệu năng + load test | A | R | C | R | R | A | I |
| P5 Observability + runbook | C | C | I | I | A | I | I |
| P6 Beta/GA + nội dung | C | I | I | I | R | C | A |

## 3. Phân bổ nhân sự theo phase (tránh quá tải)

| Phase | TL | BE×2 | AI | FE×2 | OPS | QA | Ghi chú tải |
|---|---|---|---|---|---|---|---|
| P0 (t1–3) | 100% | 100% | 40% | 60% | 100% | 40% | AI dựng khung rag, FE dựng khung portal |
| P1 (t4–9) | 60% | 100% | 20% | 100% | 20% | 60% | AI học tài liệu KB, chuẩn bị P3 |
| P2 (t10–16) | 60% | 100% | 0% | 100% | 30% | 80% | **AI tách sang P3 song song từ t17** |
| P3 (t17–24) | 70% | 40% | 100% | 100% | 20% | 80% | BE hỗ trợ SSE proxy + quota; chạy song song P2 nếu đủ người |
| P4 (t25–30) | 50% | 100% | 30% | 100% | 20% | 80% | AI tinh chỉnh eval theo feedback |
| P5 (t31–35) | 100% | 100% | 60% | 80% | 100% | 100% | Toàn đội dồn chất lượng |
| P6 (t36–38) | 80% | 60% | 40% | 60% | 100% | 100% | Trực beta, sửa lỗi nóng |

## 4. Chuẩn ước lượng effort & phân rã task

Roadmap dừng ở mức sprint. Khi vào sprint, mỗi mục được phân rã thành task cấp dev theo chuẩn:

- **Đơn vị**: story point Fibonacci (1, 2, 3, 5, 8, 13). >13 phải chẻ nhỏ.
- **Quy đổi tham chiếu**: 1 SP ≈ 0,5 ngày người; 1 sprint (2 tuần) ≈ 16 SP/dev sau khi trừ họp/review/đệm 20%.
- **Mỗi task phải có**: owner (1 người), estimate (SP), Definition of Done (mục 5), liên kết tới spec/PRD tương ứng, và các task chặn (blockedBy).
- **Công cụ**: backlog trên bảng dự án (GitHub Projects/Linear); task = issue, gắn nhãn phase + component (`api`/`web`/`rag`/`infra`).

### 4.1 Ví dụ phân rã (P2.3 Realtime chat)

| Task | Owner | SP | DoD tham chiếu | Chặn bởi |
|---|---|---|---|---|
| Socket.IO gateway + Redis adapter + auth handshake | BE1 | 5 | spec-06 §1–2 | P2.1 |
| Gửi tin: seq + idempotency + transaction | BE1 | 5 | spec-06 §4 | ↑ |
| Presence + typing + read receipt | BE2 | 3 | spec-06 §3,5 | ↑ |
| Offline delivery (BullMQ + FCM) | BE2 | 5 | spec-06 §4.2 | ↑ |
| Chat UI + reconnect + lấp gap seq | FE1 | 8 | spec-06 §8 | gateway |
| Load test socket k6/artillery | QA | 3 | roadmap P2 exit | tất cả trên |

## 5. Definition of Done (cấp task — áp dụng toàn dự án)

Một task chỉ `done` khi **tất cả** đạt:
- [ ] Code khớp spec/PRD được tham chiếu; không lệch phạm vi
- [ ] Unit test cho logic mới, coverage nhánh thay đổi ≥ ngưỡng (xem PLAN-02)
- [ ] Integration test cho endpoint/luồng mới (chạm DB thật qua testcontainers, không mock DB)
- [ ] Zod validate + error envelope + i18n cho chuỗi người dùng thấy
- [ ] Không có secret hard-code; qua `gitleaks` CI
- [ ] PR được TL (hoặc peer được uỷ quyền) review và approve
- [ ] CI xanh (lint, typecheck, test, security scan, build)
- [ ] AC liên quan (nếu có) được PO tick trên môi trường staging

## 6. Nhịp làm việc

- Sprint 2 tuần: planning (t đầu), daily async standup, review + demo cho PO (t cuối), retro.
- Code review: mọi PR cần ≥1 approve; PR chạm `apps/rag`, auth, hoặc security cần TL approve. PR > 400 dòng thay đổi nên được chẻ nhỏ.
- Định nghĩa "sẵn sàng làm" (Definition of Ready): task có spec tham chiếu, estimate, không còn câu hỏi mở → mới kéo vào sprint.
