# SPEC-00 — Kiến trúc hệ thống

Liên quan: toàn bộ `prd/`, `spec/08-devops.md`

## 1. Sơ đồ tổng thể

```
                        ┌─────────────────────────────┐
   Người dùng ─────────►│ Cloudflare (DNS, CDN, WAF,  │
   (web / PWA)          │ DDoS L3-L7, Bot management) │
                        └──────────────┬──────────────┘
                                       │ TLS 1.3
                        ┌──────────────▼──────────────┐
                        │  Nginx / Traefik (reverse    │
                        │  proxy, TLS term, rate limit)│
                        └───┬──────────┬──────────┬────┘
                            │          │          │
            ┌───────────────▼──┐  ┌────▼──────┐  ┌▼──────────────┐
            │ web (Next.js 15) │  │ api       │  │ rag-service   │
            │ SSR + PWA        │  │ Node 22   │  │ Python 3.12   │
            │                  │  │ Express 5 │  │ FastAPI       │
            └──────────────────┘  └────┬──────┘  └────┬──────────┘
                                       │              │
                         ┌─────────────┼──────────────┼──────────────┐
                         │             │              │              │
                    ┌────▼────┐  ┌─────▼─────┐  ┌─────▼─────┐  ┌────▼─────┐
                    │ MongoDB │  │  Redis    │  │  Qdrant   │  │ Elastic- │
                    │ replica │  │ cache,    │  │  vector   │  │ search 8 │
                    │ set     │  │ session,  │  │  DB       │  │          │
                    │         │  │ queue,    │  │           │  │          │
                    │         │  │ pubsub    │  │           │  │          │
                    └─────────┘  └───────────┘  └───────────┘  └──────────┘
                         ▲             ▲
                    ┌────┴─────────────┴────┐        ┌──────────────────┐
                    │ worker (BullMQ)       │        │ MinIO / S3       │
                    │ media, index, email,  │───────►│ object storage   │
                    │ notification, cleanup │        │ (ảnh, video, doc)│
                    └───────────────────────┘        └──────────────────┘

   Bên thứ ba:  Google Gemini (LLM + embedding) · Serper (web search) ·
                Resend/SES (email) · FCM (push) · Google Safe Browsing
```

## 2. Danh sách service

| Service | Ngôn ngữ / Framework | Trách nhiệm | Trạng thái |
|---|---|---|---|
| `web` | Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui | Giao diện 4 portal + admin console, SSR/ISR, PWA | Stateless |
| `api` | Node 22, Express 5, TypeScript | REST API, auth, RBAC, business logic, Socket.IO gateway | Stateless |
| `rag-service` | Python 3.12, FastAPI, Pydantic v2 | Ingest tài liệu, chunk, embed, hybrid retrieval, rerank, orchestrate LLM, web search | Stateless |
| `worker` | Node 22, BullMQ | Job bất đồng bộ: xử lý media, index ES, email, push, dọn dẹp, tính feed score | Stateless |
| `mongodb` | MongoDB 7 | Nguồn sự thật (source of truth) | Stateful |
| `redis` | Redis 7 | Cache, session, rate limit, queue, pub/sub cho Socket.IO | Stateful |
| `qdrant` | Qdrant 1.12+ | Vector + sparse index cho RAG | Stateful |
| `elasticsearch` | Elasticsearch 8 | Tìm kiếm toàn văn, aggregation | Stateful (rebuild được) |
| `minio` | MinIO (dev) / S3 (prod) | Object storage | Stateful |

## 3. Quyết định kiến trúc (ADR tóm gọn)

### ADR-01 — Modular monolith cho `api`, không microservice ngay

Ở quy mô v1 (một nhóm nhỏ, 5.000 CCU mục tiêu), microservice tạo chi phí vận hành và độ phức tạp phân tán không tương xứng. Thay vào đó `api` được chia module theo domain với biên giới rõ ràng:

```
src/modules/
  auth/  users/  orgs/  posts/  comments/  reactions/  follows/
  messaging/  notifications/  places/  tours/  listings/  inquiries/
  planner/  search/  moderation/  admin/  media/
```

Quy tắc: module chỉ gọi module khác qua service layer công khai (`modules/x/x.service.ts`), không import repository của nhau. Vi phạm bị chặn bởi ESLint `import/no-restricted-paths`. Nhờ vậy khi cần tách microservice, biên giới đã sẵn.

### ADR-02 — Tách `rag-service` riêng bằng Python

Lý do: hệ sinh thái RAG (unstructured, langchain/llamaindex, tokenizer, reranker) trưởng thành hơn ở Python; đặc tính tải khác biệt (CPU cho embedding, chờ I/O dài cho LLM) nên cần scale độc lập; lỗi ở planner không được làm sập API chính.

Giao tiếp: `api` → `rag-service` qua HTTP nội bộ (không expose ra ngoài), xác thực bằng service token (HMAC) + mTLS ở production. Streaming trả về `api` bằng SSE và được `api` chuyển tiếp tới client.

### ADR-03 — Qdrant làm vector database

| Tiêu chí | Qdrant | pgvector | Milvus | Weaviate |
|---|---|---|---|---|
| Hybrid dense+sparse gốc | ✅ (named vectors + BM25 sparse) | ⚠️ cần tự ghép | ✅ | ✅ |
| Filter theo payload khi search | ✅ mạnh, pre-filter | ✅ | ⚠️ | ✅ |
| Chi phí vận hành | Thấp (1 binary Rust) | Rất thấp nếu đã có PG | Cao (nhiều thành phần) | Trung bình |
| Phù hợp stack MongoDB | ✅ độc lập | ❌ phải thêm Postgres | ✅ | ✅ |
| Snapshot / replication | ✅ | ✅ | ✅ | ✅ |

Chọn **Qdrant**: hybrid search sẵn có (quan trọng với tiếng Việt — BM25 bắt tên riêng, dense bắt ngữ nghĩa), pre-filter theo metadata mạnh (lọc `lang`, `region`, `published` trước khi tính ANN nên không mất recall), một container duy nhất. pgvector bị loại vì phải thêm Postgres chỉ để làm vector store khi main DB đã là MongoDB.

### ADR-04 — MongoDB là nguồn sự thật, Elasticsearch là chỉ mục phái sinh

Mọi ghi đi vào MongoDB trước. Đồng bộ sang ES bất đồng bộ qua outbox pattern + worker (chi tiết `spec/04-search.md §5`). ES có thể mất hoàn toàn và rebuild từ MongoDB. Không bao giờ đọc dữ liệu quyết định nghiệp vụ từ ES.

### ADR-05 — Gemini cho LLM và embedding

- Sinh câu trả lời: `gemini-2.5-flash` mặc định (nhanh, rẻ, đủ tốt cho hỏi đáp du lịch), `gemini-2.5-pro` cho câu hỏi lập kế hoạch phức tạp — chọn bằng bộ phân loại độ khó.
- Embedding: `gemini-embedding-001` (đa ngôn ngữ, hỗ trợ tiếng Việt tốt), 768 chiều.
- Lớp trừu tượng `LLMProvider` để đổi nhà cung cấp không phải viết lại logic; model version cấu hình được ở runtime (`prd/04-admin.md §8`).

### ADR-06 — Socket.IO thay vì WebSocket thuần

Cần fallback (long-polling) cho mạng di động Việt Nam không ổn định, room/namespace sẵn có, và Redis adapter cho scale ngang. Chi tiết `spec/06-realtime.md`.

## 4. Luồng dữ liệu chính

### 4.1 Đăng bài

```
Client ──POST /v1/posts (multipart hoặc pre-signed upload)──► api
  api: validate (Zod) → kiểm quyền → kiểm rate limit
     → ghi Post (status=processing nếu có media) + ghi Outbox trong 1 transaction
     → 202 Accepted
  worker(media):  tải ảnh → kiểm magic bytes → quét malware → resize 3 cỡ
                  → WebP/AVIF → upload S3 → cập nhật Post.media → status=published
  worker(outbox): đọc Outbox → index vào Elasticsearch → đánh dấu đã xử lý
  worker(fanout): tính điểm feed → đẩy vào feed cache của follower (Redis)
  api → Socket.IO: phát `post:created` tới room follower đang online
```

### 4.2 Chat planner (một lượt)

```
Client ──POST /v1/planner/conversations/:id/messages (SSE)──► api
  api: auth → kiểm quota → lưu message người dùng → gọi rag-service (stream)
  rag-service:
    1. Chuẩn hoá + phát hiện prompt injection
    2. Phân loại ý định & độ khó → chọn model, quyết định có cần web search
    3. Viết lại truy vấn (query rewrite) theo ngữ cảnh hội thoại
    4. Kiểm cache semantic (Qdrant, cosine ≥ 0.95) → hit thì trả luôn
    5. Hybrid retrieval Qdrant (dense + sparse, RRF) với filter lang/region/published
    6. Rerank top-30 → top-6 (cross-encoder BGE-reranker-v2-m3)
    7. (nếu cần) Serper search → trích nội dung → thêm vào ngữ cảnh
    8. (nếu cần) Truy vấn dữ liệu nền tảng qua api nội bộ: place, tour, listing (verified)
    9. Ghép prompt → Gemini stream → phát SSE kèm citation
   10. Hậu kiểm: citation có thật, không rò rỉ system prompt, lọc PII
  api: chuyển tiếp SSE → client; lưu message assistant + citation + số token + chi phí
```

### 4.3 Nạp tài liệu vào KB

```
Admin ──POST /v1/admin/kb/documents (file)──► api → S3 + Document(status=processing)
  api ──POST /internal/ingest──► rag-service (bất đồng bộ, trả job id)
  rag-service:
    trích văn bản (unstructured/PyMuPDF) → dọn rác (header/footer/mục lục)
    → chia chunk theo cấu trúc (heading-aware, 512 token, overlap 64)
    → sinh dense embedding + sparse vector (BM25)
    → upsert Qdrant kèm payload đầy đủ → lưu chunk metadata vào MongoDB
    → cập nhật Document.status = draft, báo tiến độ qua webhook
  Admin xem lại chunk → chỉnh sửa → Publish → chunk chuyển published=true
```

## 5. Cấu trúc monorepo

```
travelvietplaner/
├── apps/
│   ├── web/                  # Next.js 15
│   ├── api/                  # Express 5
│   ├── worker/               # BullMQ workers (chia sẻ code với api)
│   └── rag/                  # FastAPI
├── packages/
│   ├── shared-types/         # TypeScript types + Zod schema dùng chung
│   ├── i18n/                 # File dịch vi/en dùng chung web & api
│   ├── ui/                   # Design system, component dùng chung 4 portal
│   └── config/               # eslint, tsconfig, prettier dùng chung
├── infra/
│   ├── docker/               # Dockerfile từng service
│   ├── compose/              # docker-compose.{dev,prod}.yml
│   ├── nginx/                # cấu hình reverse proxy
│   └── scripts/              # seed, migrate, backup, restore
├── docs/
│   ├── prd/  spec/  plan/    # tài liệu (bộ này)
│   └── adr/                  # ADR chi tiết khi cần
└── .github/workflows/        # CI/CD
```

Công cụ: pnpm workspaces + Turborepo cho phần TypeScript; `uv` cho Python. Một lệnh `pnpm dev` khởi động toàn bộ qua docker compose + hot reload.

## 6. Ranh giới trách nhiệm

| Việc | Thuộc service |
|---|---|
| Xác thực, phát hành token, RBAC | `api` |
| Toàn bộ ghi vào MongoDB | `api` và `worker` (không phải `rag-service`) |
| Ghi/đọc Qdrant | Chỉ `rag-service` |
| Gọi Gemini, Serper | Chỉ `rag-service` |
| Index Elasticsearch | Chỉ `worker` |
| Đọc Elasticsearch | `api` |
| Xử lý media | `worker` |
| Gửi email/push | `worker` |
| Kiểm quota planner | `api` (trước khi gọi rag) |

`rag-service` không có quyền ghi MongoDB nghiệp vụ — nó chỉ đọc metadata chunk và trả kết quả. Điều này giữ một điểm ghi duy nhất và giúp audit dễ hơn.

## 7. Nguyên tắc thiết kế xuyên suốt

1. **Deny by default** — mọi endpoint yêu cầu auth trừ danh sách allowlist tường minh.
2. **Validate ở biên** — mọi payload qua Zod (TS) / Pydantic (Python), không tin client.
3. **Idempotency** — mọi endpoint ghi nhận `Idempotency-Key` cho request tạo mới.
4. **Bất đồng bộ mọi việc nặng** — request HTTP không bao giờ chờ media/index/email.
5. **Không mất dữ liệu người dùng** — ghi DB trước, phát tán sau; queue có retry + DLQ.
6. **Quan sát được** — `traceId` xuyên suốt từ client qua api tới rag và worker.
7. **Suy giảm có kiểm soát** — mỗi phụ thuộc ngoài đều có nhánh xử lý khi lỗi (`prd/05 §4`).
8. **Cấu hình qua biến môi trường**, secret qua secret manager, không bao giờ trong code.
