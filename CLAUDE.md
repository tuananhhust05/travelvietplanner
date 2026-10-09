# TravelVietPlaner — Claude Rules

## NGUYÊN TẮC CỐT LÕI

**Không có local testing. Mọi thay đổi phải deploy lên production và test qua https://waki.autos.**

---

## ⚠️ DEPLOY PATH CHÍNH THỨC (QUAN TRỌNG)

**Project làm việc trên server là `/home/travelvietplaner/travelvietplaner/`.**

- **Đây là project DUY NHẤT** — bản copy cũ tại `/root/travelvietplaner/` đã bị xóa (2026-08-11).
- Tất cả 10 container chạy từ `/home/travelvietplaner/travelvietplaner/infra/compose`.
- Mọi lệnh `docker compose`, upload file, rebuild đều phải dùng path này.
- **User làm việc chính:** `travelvietplaner` — chỉ dùng `root` khi cần cấu hình máy (cài package, sửa system config, docker daemon...).

---

## QUY TRÌNH DEPLOY BẮT BUỘC

Mỗi khi thay đổi code, PHẢI thực hiện đúng thứ tự sau:

### 1. Thay đổi code local
- Sửa file trong `C:\data\travelvietplaner\source\`
- Không cần build hay test local

### 2. Upload file lên server
```python
# Dùng paramiko SFTP để upload
sftp.put('local/path/file.ts', '/home/travelvietplaner/travelvietplaner/remote/path/file.ts')
```

Server: `root@81.17.100.241` — credentials live outside this repository
- **User làm việc chính:** `travelvietplaner` (project ở `/home/travelvietplaner/travelvietplaner/`)
- **Chỉ dùng `root` khi cần cấu hình máy** (cài package, sửa system config, docker daemon...)

### 3. Xác định service nào cần rebuild

| File thay đổi | Service rebuild |
|--------------|----------------|
| `apps/api/src/**` | `api` |
| `apps/web/src/**` | `web` |
| `infra/nginx/nginx.conf` | `nginx` (chỉ restart, không rebuild) |
| `infra/compose/docker-compose.prod.yml` | service tương ứng |
| `apps/api/src/config.ts` | `api` |

### 4. Rebuild và restart
```bash
# Rebuild image
cd /home/travelvietplaner/travelvietplaner
docker compose -f infra/compose/docker-compose.prod.yml build <service>

# Restart container
docker compose -f infra/compose/docker-compose.prod.yml up -d --no-deps <service>

# Chỉ restart nginx (không cần rebuild)
docker compose -f infra/compose/docker-compose.prod.yml up -d --no-deps nginx
```

### 5. Verify trên production
```bash
# Check container status
docker ps --filter "name=tvp-prod-<service>-1" --format "{{.Names}} - {{.Status}}"

# Check logs
docker logs tvp-prod-<service>-1 --tail 20

# Test endpoint
curl -s -o /dev/null -w "%{http_code}" https://waki.autos/<path>
```

### 6. Test qua browser
- Mở https://waki.autos và test trực tiếp
- Hard refresh: Ctrl+Shift+R để clear browser cache

---

## CẤU TRÚC DOCKER SERVICES

```
tvp-prod-nginx-1      — reverse proxy, serve /file/ static
tvp-prod-web-1        — Next.js frontend (port 3000)
tvp-prod-api-1        — Express API (port 4000)
tvp-prod-worker-1     — background worker
tvp-prod-mongodb-1    — MongoDB
tvp-prod-redis-1      — Redis
tvp-prod-elasticsearch-1
tvp-prod-qdrant-1
tvp-prod-rag-1
```

---

## KIẾN TRÚC FILE STORAGE

- Files upload được lưu vào `/data/uploads/` trên host server (ngoài source repo)
- Nginx serve qua `location /file/ { alias /data/uploads/; }`
- API trả về URL dạng `/file/<userId>/<uuid>.ext` (relative, không có domain)
- **KHÔNG dùng MinIO/S3** — đã migrate sang disk

---

## CÁC LỖI ĐÃ GẶP — KHÔNG LẶP LẠI

### 1. Avatar URL trỏ localhost
**Nguyên nhân:** `storage.ts` dùng `PUBLIC_WEB_URL` để build URL → hardcode localhost  
**Fix:** URL trả về phải là relative path `/file/...`, không bao giờ absolute URL có domain/localhost

### 2. Header không cập nhật sau khi đổi ảnh
**Nguyên nhân:** `handleAvatarUpload` không gọi `refreshUser()` từ auth context  
**Fix:** Sau mọi thao tác update profile, phải gọi `await refreshUser()` để sync auth context

### 3. Google OAuth redirect về localhost
**Nguyên nhân:** NextAuth callback chạy server-side, `NEXT_PUBLIC_API_URL` chỉ available ở build time → fallback `/api` → relative URL không resolve trong container  
**Fix:** Dùng `INTERNAL_API_URL=http://api:4000` cho server-side calls trong NextAuth

### 4. localStorage cache giữ URL cũ
**Nguyên nhân:** `tvp_user` trong localStorage chứa avatarUrl cũ, không bị clear khi deploy  
**Fix:** `getCachedUser()` trong `auth.ts` detect URL `/uploads/` và tự xóa cache

### 5. `avatarUrl` trong `profiles[]` khác với root `user.avatarUrl`
**Nguyên nhân:** MongoDB có 2 field: `user.avatarUrl` và `user.profiles[].avatarUrl` — `mapUser()` ưu tiên profile  
**Fix:** Khi update avatarUrl, phải update cả 2 field trong DB

### 6. Upload ảnh bị 404 khi xem (nginx không thấy file)
**Nguyên nhân:** Service `nginx` trong compose file thiếu volume `- /data/uploads:/data/uploads:ro`. File upload được lưu vào `/data/uploads/` trên host nhưng container nginx không mount thư mục này → `location /file/` trả 404.  
**Fix:** Đảm bảo service `nginx` trong `docker-compose.prod.yml` có mount `/data/uploads:/data/uploads:ro`, rồi recreate container nginx.

### 7. Đăng bài có ảnh bị lỗi validation
**Nguyên nhân:** `createSchema` trong `posts.routes.ts` dùng `z.string().url()` cho `media[].url`, nhưng upload trả về URL **tương đối** `/file/...` → bị reject.  
**Fix:** Validator phải chấp nhận cả relative path `/file/...` và absolute URL.

---

## ENV VARS QUAN TRỌNG

### API container
```
PUBLIC_WEB_URL=https://waki.autos
CORS_ORIGINS=https://waki.autos
UPLOAD_DIR=/data/uploads
```

### Web container (runtime)
```
NEXTAUTH_URL=https://waki.autos
INTERNAL_API_URL=http://api:4000   ← server-side API calls trong NextAuth
```

### Web container (build-time arg)
```
NEXT_PUBLIC_API_URL=/api           ← client-side API calls
```

---

## CHECKLIST TRƯỚC KHI BÁO XONG

- [ ] Code đã upload lên server
- [ ] Service liên quan đã rebuild
- [ ] Container đã restart và status Up
- [ ] Logs không có error
- [ ] Test trực tiếp trên https://waki.autos
- [ ] Không có localhost URL nào bị hardcode trong response
