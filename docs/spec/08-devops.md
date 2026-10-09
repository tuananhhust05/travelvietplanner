# SPEC-08 — DevOps & Docker Compose

## 1. Môi trường

| Môi trường | Mục đích | Hạ tầng | Dữ liệu |
|---|---|---|---|
| `local` | Phát triển | Docker Compose, hot reload | Seed giả lập |
| `ci` | Test tự động | Compose ephemeral trong GitHub Actions | Fixture |
| `staging` | Kiểm thử trước release | 1 VPS (4 vCPU, 16GB) hoặc cluster nhỏ | Bản sao đã ẩn danh hoá từ prod |
| `production` | Vận hành thật | ≥2 node app + node dữ liệu riêng | Thật |

Cấu hình qua biến môi trường. Không có `if (env === 'production')` rải rác trong code — mọi khác biệt biểu diễn bằng biến cấu hình.

## 2. Cấu trúc Compose

```
infra/compose/
├── docker-compose.yml            # nền tảng: service, network, volume
├── docker-compose.dev.yml        # override: hot reload, mount source, expose port
├── docker-compose.prod.yml       # override: replica, resource limit, không expose
├── docker-compose.ci.yml         # override: tmpfs, không persist
└── .env.example                  # danh sách đầy đủ biến, không có giá trị thật
```

Chạy: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`. Makefile bọc lại thành `make dev`, `make prod`, `make test`.

## 3. docker-compose.yml (nền tảng)

```yaml
name: tvp

x-logging: &default-logging
  driver: json-file
  options: { max-size: "20m", max-file: "5" }

x-app-common: &app-common
  restart: unless-stopped
  logging: *default-logging
  networks: [backend]
  env_file: [../../.env]

services:
  # ─────────────────── Edge ───────────────────
  nginx:
    image: nginx:1.27-alpine
    depends_on: { api: { condition: service_healthy }, web: { condition: service_started } }
    ports: ["80:80", "443:443"]
    volumes:
      - ../nginx/conf.d:/etc/nginx/conf.d:ro
      - ../nginx/certs:/etc/nginx/certs:ro
      - nginx_cache:/var/cache/nginx
    networks: [frontend, backend]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/nginx-health"]
      interval: 30s, timeout: 5s, retries: 3

  # ─────────────────── Application ───────────────────
  web:
    <<: *app-common
    build: { context: ../.., dockerfile: infra/docker/web.Dockerfile, target: runner }
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${PUBLIC_API_URL}
      NEXT_PUBLIC_WS_URL: ${PUBLIC_WS_URL}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s, timeout: 5s, retries: 3, start_period: 40s

  api:
    <<: *app-common
    build: { context: ../.., dockerfile: infra/docker/api.Dockerfile, target: runner }
    environment:
      NODE_ENV: production
      PORT: 4000
      MONGODB_URI: ${MONGODB_URI}
      REDIS_URL: ${REDIS_URL}
      ELASTICSEARCH_NODE: http://elasticsearch:9200
      RAG_SERVICE_URL: http://rag:8000
      JWT_PRIVATE_KEY_PATH: /run/secrets/jwt_private
      S3_ENDPOINT: ${S3_ENDPOINT}
    secrets: [jwt_private, jwt_public, mongo_password, encryption_key]
    depends_on:
      mongodb:      { condition: service_healthy }
      redis:        { condition: service_healthy }
      elasticsearch:{ condition: service_healthy }
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/healthz"]
      interval: 15s, timeout: 5s, retries: 4, start_period: 30s

  worker:
    <<: *app-common
    build: { context: ../.., dockerfile: infra/docker/api.Dockerfile, target: runner }
    command: ["node", "dist/worker/index.js"]
    environment:
      WORKER_CONCURRENCY: ${WORKER_CONCURRENCY:-5}
      WORKER_QUEUES: media,indexer,notification,email,cleanup,scoring
    secrets: [mongo_password, encryption_key]
    depends_on:
      mongodb: { condition: service_healthy }
      redis:   { condition: service_healthy }
    healthcheck:
      test: ["CMD", "node", "dist/worker/healthcheck.js"]
      interval: 30s, timeout: 10s, retries: 3, start_period: 30s

  rag:
    <<: *app-common
    build: { context: ../.., dockerfile: infra/docker/rag.Dockerfile }
    environment:
      QDRANT_URL: http://qdrant:6333
      REDIS_URL: ${REDIS_URL}
      API_INTERNAL_URL: http://api:4000
      GEMINI_MODEL_FAST: gemini-2.5-flash
      GEMINI_MODEL_SMART: gemini-2.5-pro
      EMBEDDING_MODEL: gemini-embedding-001
      RERANKER_MODEL: BAAI/bge-reranker-v2-m3
      UVICORN_WORKERS: ${RAG_WORKERS:-2}
    secrets: [gemini_api_key, serper_api_key, service_token]
    volumes: [rag_models:/models]           # cache model reranker, tránh tải lại
    depends_on: { qdrant: { condition: service_healthy } }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/internal/rag/health').status==200 else 1)"]
      interval: 20s, timeout: 10s, retries: 4, start_period: 90s   # dài vì phải nạp reranker

  # ─────────────────── Data ───────────────────
  mongodb:
    image: mongo:7.0
    command: >
      mongod --replSet rs0 --bind_ip_all --keyFile /run/secrets/mongo_keyfile
             --wiredTigerCacheSizeGB ${MONGO_CACHE_GB:-2}
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USER}
      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_password
    secrets: [mongo_password, mongo_keyfile]
    volumes:
      - mongo_data:/data/db
      - mongo_config:/data/configdb
      - ../scripts/mongo-init.js:/docker-entrypoint-initdb.d/init.js:ro
    networks: [backend]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
      interval: 15s, timeout: 10s, retries: 6, start_period: 40s

  mongo-init-replica:            # chạy một lần rồi thoát
    image: mongo:7.0
    depends_on: { mongodb: { condition: service_healthy } }
    entrypoint: ["/bin/bash", "/scripts/init-replica.sh"]
    volumes: [../scripts:/scripts:ro]
    secrets: [mongo_password]
    networks: [backend]
    restart: "no"

  redis:
    image: redis:7.4-alpine
    command: >
      redis-server --requirepass-file /run/secrets/redis_password
                   --appendonly yes --appendfsync everysec
                   --maxmemory ${REDIS_MAXMEM:-1gb} --maxmemory-policy noeviction
    secrets: [redis_password]
    volumes: [redis_data:/data]
    networks: [backend]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$$(cat /run/secrets/redis_password)\" ping | grep PONG"]
      interval: 15s, timeout: 5s, retries: 4

  qdrant:
    image: qdrant/qdrant:v1.12.4
    environment:
      QDRANT__SERVICE__API_KEY_FILE: /run/secrets/qdrant_api_key
      QDRANT__STORAGE__SNAPSHOTS_PATH: /qdrant/snapshots
      QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB: "204800"
      QDRANT__LOG_LEVEL: INFO
    secrets: [qdrant_api_key]
    volumes:
      - qdrant_data:/qdrant/storage
      - qdrant_snapshots:/qdrant/snapshots
    networks: [backend]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "bash -c ':> /dev/tcp/127.0.0.1/6333' || exit 1"]
      interval: 20s, timeout: 5s, retries: 5, start_period: 20s

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.15.3
    environment:
      discovery.type: single-node                    # prod: đổi sang cluster 3 node
      ES_JAVA_OPTS: -Xms${ES_HEAP:-1g} -Xmx${ES_HEAP:-1g}
      xpack.security.enabled: "true"
      ELASTIC_PASSWORD_FILE: /run/secrets/es_password
      cluster.routing.allocation.disk.watermark.low: 85%
    secrets: [es_password]
    ulimits: { memlock: { soft: -1, hard: -1 }, nofile: { soft: 65536, hard: 65536 } }
    volumes: [es_data:/usr/share/elasticsearch/data]
    networks: [backend]
    restart: unless-stopped
    logging: *default-logging
    healthcheck:
      test: ["CMD-SHELL", "curl -sf -u elastic:$$(cat /run/secrets/es_password) http://localhost:9200/_cluster/health?wait_for_status=yellow&timeout=5s"]
      interval: 20s, timeout: 10s, retries: 8, start_period: 60s

  minio:                                             # chỉ local/staging; prod dùng S3
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_password
    secrets: [minio_password]
    volumes: [minio_data:/data]
    networks: [backend]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 20s, timeout: 5s, retries: 5

networks:
  frontend: { driver: bridge }
  backend:  { driver: bridge, internal: false }      # prod: internal true + edge riêng

volumes:
  mongo_data: {}   mongo_config: {}   redis_data: {}
  qdrant_data: {}  qdrant_snapshots: {}
  es_data: {}      minio_data: {}     rag_models: {}   nginx_cache: {}

secrets:
  jwt_private:    { file: ../secrets/jwt_private.pem }
  jwt_public:     { file: ../secrets/jwt_public.pem }
  mongo_password: { file: ../secrets/mongo_password }
  mongo_keyfile:  { file: ../secrets/mongo_keyfile }
  redis_password: { file: ../secrets/redis_password }
  es_password:    { file: ../secrets/es_password }
  qdrant_api_key: { file: ../secrets/qdrant_api_key }
  minio_password: { file: ../secrets/minio_password }
  encryption_key: { file: ../secrets/encryption_key }
  gemini_api_key: { file: ../secrets/gemini_api_key }
  serper_api_key: { file: ../secrets/serper_api_key }
  service_token:  { file: ../secrets/service_token }
```

Ghi chú quan trọng:

- **Không expose port của service dữ liệu** ra host ở production. Ở dev, override thêm `ports` để dùng công cụ GUI.
- **MongoDB replica set bắt buộc** dù chỉ một node — transaction và change stream cần replica set. `mongo-init-replica` chạy `rs.initiate()` một lần.
- **Redis `maxmemory-policy noeviction`** vì Redis giữ session và queue; nếu dùng `allkeys-lru` thì job và session sẽ bị xoá âm thầm khi đầy bộ nhớ. Cache có TTL riêng nên không cần eviction.
- **Secrets qua file**, không qua biến môi trường — biến môi trường xuất hiện trong `docker inspect` và log của process.
- **`start_period` dài cho `rag`** vì nạp model reranker mất 30–60s; nếu quá ngắn container sẽ bị restart liên tục.

## 4. Override cho dev

```yaml
# docker-compose.dev.yml
services:
  web:
    build: { target: dev }
    command: pnpm --filter web dev
    volumes: [../../apps/web:/app/apps/web, ../../packages:/app/packages, /app/node_modules]
    ports: ["3000:3000"]
    environment: { NODE_ENV: development, WATCHPACK_POLLING: "true" }

  api:
    build: { target: dev }
    command: pnpm --filter api dev            # tsx watch
    volumes: [../../apps/api:/app/apps/api, ../../packages:/app/packages, /app/node_modules]
    ports: ["4000:4000", "9229:9229"]         # 9229 để attach debugger
    environment: { NODE_ENV: development, LOG_LEVEL: debug, LOG_PRETTY: "true" }

  rag:
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes: [../../apps/rag:/app]
    ports: ["8000:8000"]

  mongodb:      { ports: ["27017:27017"] }
  redis:        { ports: ["6379:6379"] }
  qdrant:       { ports: ["6333:6333", "6334:6334"] }
  elasticsearch:{ ports: ["9200:9200"] }
  minio:        { ports: ["9000:9000", "9001:9001"] }

  mailhog:                                     # bắt email ở dev, không gửi thật
    image: axllent/mailpit:latest
    ports: ["8025:8025"]
    networks: [backend]
```

`make dev` = `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` rồi chạy `make seed`.

## 5. Override cho production

```yaml
# docker-compose.prod.yml
services:
  web:
    deploy:
      replicas: 2
      resources: { limits: { cpus: "1", memory: 1G }, reservations: { memory: 512M } }
      update_config: { order: start-first, failure_action: rollback, delay: 10s }
  api:
    deploy:
      replicas: 3
      resources: { limits: { cpus: "1.5", memory: 1.5G } }
      update_config: { order: start-first, failure_action: rollback, delay: 10s }
  worker:
    deploy: { replicas: 2, resources: { limits: { cpus: "2", memory: 2G } } }
  rag:
    deploy: { replicas: 2, resources: { limits: { cpus: "2", memory: 3G } } }
  minio: { profiles: ["disabled"] }            # dùng S3 thật
```

Tất cả service app đặt `read_only: true` với `tmpfs: [/tmp]`, `security_opt: [no-new-privileges:true]`, `cap_drop: [ALL]`, và chạy bằng user không phải root.

`order: start-first` cho phép rolling update không downtime: container mới khoẻ trước khi container cũ bị dừng. Cần Nginx đọc lại upstream — dùng `nginx -s reload` trong hook hoặc chuyển sang Traefik (tự phát hiện qua Docker label) nếu cần zero-config.

Ở quy mô lớn hơn, chuyển sang Docker Swarm hoặc Kubernetes. Compose đủ tới ~3 node; ADR ghi rõ điểm chuyển đổi là khi cần autoscale hoặc multi-region.

### 5.1 TLS & chứng chỉ

Kiến trúc hai lớp TLS với Cloudflare ở biên:
- **Cloudflare → origin**: chế độ **Full (strict)** — Cloudflare xác minh chứng chỉ hợp lệ ở origin, không dùng Flexible (Flexible để hở đoạn Cloudflare→origin ở HTTP, dễ bị MITM nội mạng). Origin dùng **Cloudflare Origin CA certificate** (hiệu lực 15 năm, chỉ Cloudflare tin) gắn vào Nginx — không cần auto-renew thường xuyên.
- **Phương án không phụ thuộc Cloudflare cho cert** (khi bypass Cloudflare hoặc cần cert công khai): container `certbot` (image `certbot/certbot`) chạy cạnh Nginx, dùng ACME HTTP-01/DNS-01 lấy Let's Encrypt. Cron trong container gọi `certbot renew --quiet` mỗi 12 giờ; sau khi gia hạn chạy `deploy-hook` gửi `nginx -s reload` để nạp cert mới không downtime. Volume `../nginx/certs` chia sẻ giữa certbot và nginx.

Cấu hình Nginx: TLS 1.3 (fallback 1.2), HSTS `max-age=63072000; includeSubDomains; preload`, OCSP stapling, ciphersuite theo Mozilla "Intermediate". Alert "chứng chỉ TLS còn < 14 ngày" (§ giám sát) là lưới an toàn phát hiện auto-renew hỏng; khi bắn cần điều tra ngay job certbot/Origin CA.
- **Chứng chỉ nội bộ (mTLS api↔rag)**: CA nội bộ tự ký, cert 90 ngày, xoay bằng script trong `infra/scripts/`, không qua Let's Encrypt (không expose Internet).

## 6. Dockerfile

### 6.1 Node (api / worker / web)

```dockerfile
# infra/docker/api.Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/*/package.json packages/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS dev
COPY . .
CMD ["pnpm", "--filter", "api", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter api build && pnpm deploy --filter api --prod /out

FROM node:22-alpine AS runner
RUN apk add --no-cache tini vips && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /out ./
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
```

Điểm cần chú ý:

- `tini` làm PID 1 để tín hiệu `SIGTERM` tới được Node — không có nó, container mất 10s timeout mỗi lần dừng và kết nối đang xử lý bị cắt đột ngột.
- Copy `package.json` trước source để tận dụng layer cache: sửa code không phải cài lại dependency.
- `pnpm deploy --prod` tạo thư mục chỉ có runtime dependency, giảm image từ ~800MB xuống ~180MB.
- Chạy bằng user `app` không phải root.
- `vips` cho `sharp` (xử lý ảnh) — chỉ cần ở `worker`, nhưng dùng chung Dockerfile nên để ở runner.

### 6.2 Python (rag)

```dockerfile
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 poppler-utils tesseract-ocr tesseract-ocr-vie \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
COPY apps/rag/pyproject.toml apps/rag/uv.lock ./
RUN uv sync --frozen --no-dev

FROM base AS runner
RUN useradd -m -u 10001 app
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH" HF_HOME=/models
COPY --chown=app:app apps/rag /app
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

`tesseract-ocr-vie` cần cho OCR tài liệu tiếng Việt dạng scan. `HF_HOME=/models` trỏ vào volume để không tải lại model reranker (~600MB) mỗi lần deploy.

### 6.3 Tối ưu image

Mục tiêu: `api` ≤ 200MB, `web` ≤ 250MB, `rag` ≤ 1.2GB (reranker chiếm phần lớn). `.dockerignore` loại `node_modules`, `.git`, `docs`, `*.test.ts`, `.env*`. Quét image bằng Trivy trong CI, chặn build nếu có CVE `high`+ trong lớp OS.

## 7. Graceful shutdown

Bắt buộc cho rolling update không mất request:

```ts
// apps/api/src/shutdown.ts
let shuttingDown = false;

process.on('SIGTERM', async () => {
  shuttingDown = true;
  logger.info('SIGTERM received, draining');

  // 1. /readyz trả 503 → load balancer ngừng gửi request mới
  // 2. Chờ 5s để LB kịp cập nhật
  await sleep(5_000);

  // 3. Đóng HTTP server, chờ request đang xử lý xong (tối đa 25s)
  await new Promise<void>((res) => server.close(() => res()));

  // 4. Ngắt socket có thông báo để client reconnect sang instance khác
  io.emit('system:reconnect'); io.close();

  // 5. Đóng worker: chờ job đang chạy hoàn tất, không nhận job mới
  await Promise.all(queues.map(q => q.close()));

  // 6. Đóng kết nối DB
  await Promise.all([mongo.close(), redis.quit(), es.close()]);
  process.exit(0);
});
```

`stop_grace_period: 40s` trong compose (lớn hơn 5 + 25 + margin). Nếu để mặc định 10s, Docker sẽ `SIGKILL` giữa lúc drain.

## 8. CI/CD (GitHub Actions)

### 8.1 Pipeline PR

```yaml
name: ci
on: { pull_request: { branches: [main, develop] } }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }

jobs:
  static:
    steps: [ checkout, setup-pnpm, install,
             "pnpm lint", "pnpm typecheck", "pnpm format:check",
             "pnpm i18n:check",              # key thiếu, placeholder lệch
             "pnpm arch:check" ]             # biên giới module (import/no-restricted-paths)

  security:
    steps: [ gitleaks, "semgrep --config p/owasp-top-ten --config p/nodejs --config p/python",
             "pnpm audit --audit-level=high", "uv run pip-audit", "hadolint infra/docker/*" ]

  test-node:
    services: [mongodb-rs, redis, elasticsearch, qdrant]
    steps: [ install, "pnpm test:unit --coverage",
             "pnpm test:integration",         # gọi API thật với DB thật
             "pnpm test:authz",               # test phân quyền chéo org/role
             upload-coverage ]

  test-python:
    services: [qdrant, redis]
    steps: [ "uv sync", "uv run pytest --cov", "uv run ruff check", "uv run mypy app" ]

  test-rag-eval:
    if: "contains(github.event.pull_request.changed_files, 'apps/rag/')"
    steps: [ "uv run python -m eval.run --golden eval/golden.jsonl --fail-under recall@5=0.85,faithfulness=0.90" ]

  test-e2e:
    steps: [ "docker compose -f ...ci.yml up -d --wait", "pnpm seed:test",
             "pnpm playwright test", upload-traces ]

  build:
    steps: [ "docker buildx bake --push (tag: pr-<sha>)", "trivy image --severity HIGH,CRITICAL --exit-code 1" ]
```

Ngưỡng chặn merge: mọi job xanh · coverage ≥ 70% toàn cục và ≥ 85% cho `modules/auth`, `modules/moderation` · không có finding security `high`+ · test phân quyền xanh 100%.

### 8.2 Deploy

| Nhánh / tag | Môi trường | Cách |
|---|---|---|
| `develop` | staging | Tự động sau khi CI xanh |
| `main` | production | Tự động, có bước approval của một người |
| tag `v*` | production | Release có changelog, ghi lại image digest |

Quy trình deploy production:

```
1. Build image, tag bằng git SHA (không dùng `latest` ở prod — không truy vết được)
2. Push lên registry (GHCR), ghi digest vào release note
3. SSH tới host → `docker compose pull`
4. Chạy migration: `docker compose run --rm api node dist/scripts/migrate.js up`
   (migration phải tương thích ngược với phiên bản code đang chạy — xem §8.3)
5. `docker compose up -d --no-deps --wait api worker rag web`  (start-first, rolling)
6. Smoke test: /healthz, /readyz, login test account, một truy vấn planner
7. Thất bại → rollback: `docker compose up -d` với digest trước đó + `migrate.js down` nếu cần
```

### 8.3 Nguyên tắc migration an toàn

Deploy rolling nghĩa là code cũ và mới chạy đồng thời trong vài phút. Do đó migration phải **tương thích ngược**, chia hai bước qua hai lần release:

1. Release N: thêm trường mới (nullable), code ghi cả trường cũ và mới, đọc trường cũ.
2. Backfill dữ liệu bằng job nền.
3. Release N+1: code đọc trường mới, ngừng ghi trường cũ.
4. Release N+2: xoá trường cũ.

Không bao giờ đổi tên hay xoá trường trong cùng release với code dùng nó. Migration bất khả hồi (xoá dữ liệu) cần phê duyệt tay và backup trước đó xác nhận thành công.

## 9. Backup & phục hồi

| Đối tượng | Cách | Tần suất | Giữ | Đích |
|---|---|---|---|---|
| MongoDB | `mongodump --oplog` + snapshot volume | Full hàng ngày 02:00 VN, oplog liên tục | 30 ngày | S3 khác region, mã hoá |
| Qdrant | Snapshot API (`POST /collections/kb_chunks/snapshots`) | Hàng ngày | 14 ngày | S3 |
| Elasticsearch | Snapshot repository (tuỳ chọn) | Hàng tuần | 4 tuần | S3 |
| Object storage | Versioning + cross-region replication | Liên tục | 90 ngày version cũ | S3 |
| Redis | RDB + AOF trên volume | AOF everysec | 3 ngày | Local + S3 hàng ngày |
| Secret | Backup thủ công có mã hoá, lưu ngoài hệ thống | Khi thay đổi | Vĩnh viễn | Vault ngoại vi |

RPO 15 phút (nhờ oplog), RTO 2 giờ.

**Kiểm chứng backup**: script `infra/scripts/verify-backup.sh` chạy tự động hàng tuần — restore bản backup mới nhất vào môi trường tạm, chạy bộ kiểm tra tính toàn vẹn (đếm document theo collection, kiểm index tồn tại, thử một truy vấn nghiệp vụ), báo cáo kết quả. Backup chưa từng được restore thành công thì coi như không có backup.

Thứ tự phục hồi thảm hoạ: hạ tầng và secret → MongoDB → Qdrant (hoặc rebuild từ `kbChunks`) → khởi động api/worker → rebuild Elasticsearch từ MongoDB → khởi động web → smoke test → mở lại lưu lượng.

## 10. Quan sát

```yaml
# thêm vào compose ở staging/production
prometheus:  { image: prom/prometheus:latest, volumes: [prom_data:/prometheus, ../monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro] }
grafana:     { image: grafana/grafana:latest, volumes: [grafana_data:/var/lib/grafana, ../monitoring/dashboards:/etc/grafana/provisioning/dashboards:ro] }
loki:        { image: grafana/loki:latest }
promtail:    { image: grafana/promtail:latest, volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"] }
otel-collector: { image: otel/opentelemetry-collector-contrib:latest }
alertmanager:{ image: prom/alertmanager:latest }
mongodb-exporter, redis-exporter, elasticsearch-exporter, node-exporter, cadvisor
```

Grafana và Prometheus **không expose ra Internet** — truy cập qua VPN hoặc SSH tunnel, hoặc đặt sau Cloudflare Access.

Dashboard tối thiểu: (1) Tổng quan hệ thống — RED metric theo endpoint, tài nguyên container; (2) Chất lượng planner — latency theo bước, cache hit rate, tỷ lệ 👍/👎, citation coverage; (3) Chi phí — token và USD theo giờ, so với ngân sách; (4) Dữ liệu — MongoDB op/s và replication lag, Redis memory, ES indexing rate, `outbox_lag_seconds`; (5) Vận hành — hàng đợi kiểm duyệt, BullMQ depth và DLQ.

Alert quan trọng (gửi tới kênh trực, không chỉ email):

| Alert | Điều kiện |
|---|---|
| Tỷ lệ lỗi cao | 5xx > 1% trong 5 phút |
| Độ trễ tăng | p95 endpoint đọc > 500ms trong 10 phút |
| Outbox tồn đọng | `outbox_lag_seconds` > 30 trong 5 phút |
| Queue tồn đọng | BullMQ waiting > 1000, hoặc DLQ có item mới |
| Chi phí LLM | > 80% ngân sách ngày |
| Phụ thuộc lỗi | Gemini/Serper error rate > 10% trong 5 phút |
| Dữ liệu | MongoDB replication lag > 10s · Redis memory > 85% · ES cluster không `green`/`yellow` · Qdrant unhealthy |
| Hạ tầng | Disk > 80% · container restart > 3 lần/10 phút · chứng chỉ TLS còn < 14 ngày |
| Bảo mật | Refresh token reuse phát hiện · login thất bại bất thường · truy cập `/admin` từ IP lạ |
| Vận hành | Item kiểm duyệt quá SLA 4h · hàng đợi verify quá 2 ngày |

## 11. Runbook & môi trường dev

Runbook lưu ở `docs/runbooks/`, mỗi file một tình huống với các bước cụ thể chạy được: `mongodb-down.md`, `es-red-cluster.md`, `qdrant-restore.md`, `ddos-active.md`, `llm-cost-spike.md`, `secret-leaked.md`, `admin-account-compromised.md`, `rollback-release.md`, `restore-from-backup.md`.

Khởi động môi trường dev từ đầu:

```bash
git clone … && cd travelvietplaner
cp infra/compose/.env.example .env         # điền GEMINI_API_KEY, SERPER_API_KEY
make secrets                                # sinh khoá JWT, mật khẩu ngẫu nhiên vào infra/secrets/
make dev                                    # compose up + hot reload
make seed                                   # 63 tỉnh, 500 place, 50 user mẫu, 200 post, 10 tài liệu KB
make test                                   # unit + integration
```

Mục tiêu: từ `git clone` tới ứng dụng chạy được ≤ 15 phút trên máy mới, không cần bước thủ công nào ngoài điền hai API key. `make doctor` kiểm tra phiên bản Docker, RAM khả dụng (cần ≥ 8GB), port trống và báo lỗi rõ ràng nếu thiếu.

`infra/secrets/` nằm trong `.gitignore` và có file `.gitkeep`. `make secrets` không ghi đè file đã có để không phá dữ liệu dev đang dùng.
