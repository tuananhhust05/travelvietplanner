# PLAN-03 — Risk Register kỹ thuật & Kế hoạch môi trường/Release

Bổ sung cho `plan/00-roadmap.md §10` (đã có 6 rủi ro **lịch trình** S1–S6). File này thêm rủi ro **kỹ thuật/kiến trúc/vận hành** và định nghĩa môi trường + quy trình release.

## 1. Risk Register kỹ thuật

Thang: Xác suất (Thấp/TB/Cao) × Tác động (Thấp/TB/Cao). Chủ = người theo dõi & kích hoạt ứng phó.

| # | Rủi ro | XS | TĐ | Ứng phó / Giảm thiểu | Chủ |
|---|---|---|---|---|---|
| T1 | ES và MongoDB lệch dữ liệu (search trả kết quả cũ/thiếu) | TB | Cao | Outbox + `external_gte` versioning; metric `outbox_lag_seconds` alert >30s; job reconcile đêm; rebuild được từ Mongo | BE |
| T2 | Socket không scale (bão presence, sticky session lệch tải) | TB | Cao | Redis adapter; presence có kiểm soát (chỉ người đang xem); load test 5.000 CCU ở P2 & P5; fan-out-on-write feed nếu cần | TL |
| T3 | Qdrant hỏng/mất dữ liệu vector | Thấp | Cao | MongoDB `kbChunks` là nguồn rebuild; snapshot Qdrant; `reindex` đã test; degradation trả lời thiếu nguồn nội bộ | AI |
| T4 | Gemini/Serper downtime hoặc đổi API/quota | TB | Cao | Circuit breaker + timeout riêng; SSE `error` retryable; fallback web+platform khi Qdrant lỗi; theo dõi quota; chuẩn bị đổi model (flash↔pro) | AI |
| T5 | Chi phí LLM/embedding vượt dự toán | TB | TB | Semantic cache + invalidation; quota theo tier; đo `costUsd`/hội thoại; ưu tiên flash; embedding batch | AI |
| T6 | Rò rỉ PII (ES không có ACL cấp doc, log lộ token) | Thấp | Cao | Chỉ index dữ liệu công khai; logger redactor; field-level encryption; verify-erasure; pentest P5 | TL |
| T7 | Prompt injection / jailbreak qua nội dung KB hoặc web | TB | Cao | Guardrail 5–6 lớp; tách data khỏi instruction; bộ 20+ mẫu injection trong eval chặn CI | AI |
| T8 | Migration MongoDB làm hỏng dữ liệu prod | Thấp | Cao | Migration versioned + rollback; backward-compatible 2-release; test trên staging + bản sao prod ẩn danh; backup trước migrate | OPS |
| T9 | Mất dữ liệu do backup không khôi phục được | Thấp | Cao | `verify-backup.sh` định kỳ restore vào môi trường sạch; RPO 15p/RTO 2h; diễn tập DR ở P5 (G5) | OPS |
| T10 | Single-VPS là điểm chết (không HA thật trên Compose) | TB | TB | Cloudflare cache giảm tải; healthcheck + restart; backup off-site; ADR ghi rõ điểm chuyển Swarm/K8s khi cần HA/multi-region | OPS |
| T11 | Chunking/OCR tiếng Việt kém → RAG nhiễu | TB | TB | Heading-aware chunk + contextualize; OCR `vie+eng`; eval bắt sớm; chunk editor cho admin sửa tay | AI |
| T12 | Nợ kỹ thuật tích luỹ do chạy song song P2/P3 | TB | TB | DoD chặt (PLAN-01 §5); TL review chéo; nhãn `quality-debt` có hạn xử lý | TL |

Rà soát risk register mỗi cuối phase; rủi ro đã đóng thì đánh dấu, rủi ro mới thì thêm.

## 2. Môi trường

| Môi trường | Mục đích | Hạ tầng | Dữ liệu | Ai truy cập |
|---|---|---|---|---|
| **local/dev** | Lập trình hằng ngày | `docker-compose.dev.yml` trên máy dev | Seed cố định (`make seed`) | Toàn đội |
| **CI** | Chạy test tự động | Compose ephemeral + testcontainers trong GitHub Actions | Sinh trong test, xoá sau | Tự động |
| **staging** | Nghiệm thu AC, e2e, pentest, thử migration | `docker-compose.prod.yml` trên VPS staging, cấu hình giống prod | Bản sao ẩn danh / seed mở rộng | Đội + PO |
| **production** | Người dùng thật | `docker-compose.prod.yml` trên VPS prod, sau Cloudflare | Dữ liệu thật, backup định kỳ | OPS + trực |

Nguyên tắc: staging **giống prod nhất có thể** (cùng compose, cùng phiên bản service, cùng biến cấu hình trừ secret). Khác biệt duy nhất là quy mô tài nguyên và dữ liệu.

## 3. Cấu hình & Secrets theo môi trường

- Cấu hình không nhạy cảm: file `.env.{dev,staging,prod}` + `systemConfig` (điều chỉnh nóng).
- Secret: **Docker secrets** (file mount), không phải biến môi trường (spec-08); không commit vào git; quét `gitleaks` trong CI.
- API key ngoài (Gemini/Serper/Cloudflare/SES/FCM): mỗi môi trường có key riêng; key prod chỉ OPS + TL biết.
- Xoay secret: quy trình trong runbook; luân chuyển khoá field-encryption ở P5.

## 4. Chiến lược nhánh & Release

```
feature/* ──PR──► develop ──(tự động)──► staging
                     │
                  release/vX.Y ──tag──► main ──(thủ công, có cổng)──► production
```

- `develop`: tích hợp liên tục; mỗi merge tự động deploy staging.
- `release/vX.Y`: cắt nhánh release, chỉ nhận bugfix; chạy full regression + QA gate.
- `main`: chỉ chứa mã đã release; tag `vX.Y.Z` (semver); deploy prod thủ công sau khi cổng đạt.
- Hotfix: `hotfix/*` từ `main` → vá → tag patch → merge ngược `develop`.

## 5. Quy trình deploy production (từ spec-08)

1. Cổng release đạt (QA gate của phase + không P1/P2 mở).
2. Backup MongoDB/Qdrant/ES trước khi deploy.
3. `git pull` tag + `docker compose pull` image đã build & quét Trivy ở CI.
4. Chạy migration (backward-compatible, hỗ trợ 2-release) — app cũ vẫn chạy được với schema mới.
5. Rolling update `order: start-first`: container mới healthy trước khi dừng container cũ; Nginx reload upstream.
6. Smoke test tự động trên prod (health, đăng nhập, một luồng đọc).
7. Theo dõi dashboard 15–30 phút; nếu lỗi → rollback (`failure_action: rollback` + tag trước).

## 6. Kế hoạch rollback

- **App**: giữ image tag trước; rollback = deploy lại tag cũ (mã tương thích ngược với schema hiện tại nhờ migration 2-release).
- **DB migration**: mỗi migration có hàm `down`; chỉ rollback schema khi bắt buộc và đã backup. Ưu tiên "roll forward" (vá tiến) hơn rollback schema.
- **Dữ liệu phái sinh (ES/Qdrant)**: rebuild từ MongoDB nếu hỏng, không rollback riêng.
- Tiêu chí kích hoạt rollback: xuất hiện lỗi P1, hoặc tỷ lệ lỗi/độ trễ vượt ngưỡng alert trong 15 phút sau deploy.

## 7. Cadence release sau GA

- Release đều đặn 2 tuần/lần (theo sprint) cho tính năng; hotfix bất kỳ lúc nào cho P1/P2.
- Feature flag (`systemConfig`) để bật dần tính năng mới cho nhóm nhỏ trước khi mở rộng.
- Changelog + migration note mỗi release; thông báo bảo trì nếu có downtime dự kiến.
