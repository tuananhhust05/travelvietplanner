# SPEC-06 — Realtime (Socket.IO)

Gateway nằm trong `api` (cùng process, cùng auth), scale ngang bằng Redis adapter.

## 1. Kết nối

```
wss://api.travelvietplaner.com/socket.io/?EIO=4&transport=websocket
```

Cấu hình server:

```ts
const io = new Server(httpServer, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],   // polling là fallback cho mạng di động kém
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  pingInterval: 25_000, pingTimeout: 20_000,
  maxHttpBufferSize: 1e6,                 // 1MB, chặn payload lớn qua socket
  connectionStateRecovery: {              // khôi phục tin nhắn bị mất khi mạng chớp tắt
    maxDisconnectionDuration: 120_000,
    skipMiddlewares: false,               // vẫn xác thực lại khi recover
  },
  adapter: createAdapter(pubClient, subClient),
});
```

Xác thực bằng middleware, không bằng query string (query bị ghi vào log proxy):

```ts
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  const claims = await verifyAccessToken(token);        // ném lỗi nếu hết hạn
  if (await isTokenVersionStale(claims)) return next(new Error('TOKEN_STALE'));
  socket.data.userId = claims.sub;
  socket.data.orgIds = await getActiveOrgIds(claims.sub);
  next();
});
```

Access token sống 15 phút. Client tự refresh và gọi `socket.emit('auth:refresh', { token })`; server xác thực lại và cập nhật `socket.data`. Nếu token hết hạn mà không refresh, server ngắt kết nối với `disconnect(true)` và mã `TOKEN_EXPIRED` — client tự reconnect sau khi refresh.

Giới hạn: 5 kết nối đồng thời/user (nhiều tab), 20/IP. Vượt → từ chối handshake.

## 2. Namespace & Room

| Namespace | Mục đích |
|---|---|
| `/` | Thông báo, hiện diện, feed, cập nhật đếm |
| `/chat` | Nhắn tin |
| `/planner` | Không dùng — planner dùng SSE qua HTTP (đơn hướng, không cần socket) |

| Room | Ai vào | Nhận gì |
|---|---|---|
| `user:{userId}` | Chính user (mọi thiết bị) | Thông báo, đếm chưa đọc, cập nhật quota |
| `org:{orgId}` | Member đang active | Inquiry mới, booking request, cập nhật listing |
| `conv:{conversationId}` | Participant | Tin nhắn, typing, read receipt |
| `feed:{userId}` | Chính user | Tín hiệu có bài mới (không phải nội dung bài) |
| `post:{postId}` | Người đang mở bài đó | Comment mới, đếm reaction |

Client không tự join room. Mọi `join` do server thực hiện sau khi kiểm quyền:

```ts
socket.on('conv:subscribe', async ({ conversationId }, ack) => {
  const ok = await conversationService.isParticipant(socket.data.userId, conversationId);
  if (!ok) return ack({ error: 'FORBIDDEN' });
  socket.join(`conv:${conversationId}`);
  ack({ ok: true, lastSeq: await conversationService.lastSeq(conversationId) });
});
```

Đây là điểm rò rỉ dữ liệu phổ biến nhất với Socket.IO: nếu cho client tự join theo tên room, ai cũng đọc được hội thoại của người khác.

## 3. Sự kiện

### 3.1 Server → Client

| Event | Payload | Room |
|---|---|---|
| `notification:new` | `{ id, type, actors[], target, payload, createdAt }` | `user:{id}` |
| `notification:count` | `{ unread }` | `user:{id}` |
| `message:new` | `{ conversationId, seq, sender, body, attachments[], replyToSeq, createdAt }` | `conv:{id}` |
| `message:revoked` | `{ conversationId, seq }` | `conv:{id}` |
| `message:read` | `{ conversationId, userId, seq }` | `conv:{id}` |
| `typing` | `{ conversationId, userId, isTyping }` | `conv:{id}` |
| `presence:update` | `{ userId, status: 'online'\|'away'\|'offline', lastSeenAt }` | `user:{followerId}` (giới hạn) |
| `conversation:updated` | `{ conversationId, lastMessage, unread }` | `user:{id}` |
| `feed:new_posts` | `{ count, latestPostId }` | `feed:{userId}` |
| `post:comment` | `{ postId, comment }` | `post:{postId}` |
| `post:counters` | `{ postId, counters }` | `post:{postId}` |
| `inquiry:new` | `{ inquiryId, orgId, preview }` | `org:{orgId}` |
| `moderation:decision` | `{ targetKind, targetId, decision, reason }` | `user:{id}` |
| `quota:updated` | `{ plannerMessagesLeft, resetAt }` | `user:{id}` |
| `system:announcement` | `{ level, message: { vi, en } }` | broadcast |

### 3.2 Client → Server

| Event | Payload | Ack |
|---|---|---|
| `conv:subscribe` / `conv:unsubscribe` | `{ conversationId }` | `{ ok, lastSeq }` |
| `post:subscribe` / `post:unsubscribe` | `{ postId }` | `{ ok }` |
| `message:send` | `{ conversationId, clientMsgId, body, attachments[], replyToSeq }` | `{ seq, createdAt }` hoặc `{ error }` |
| `message:read` | `{ conversationId, seq }` | `{ ok }` |
| `typing` | `{ conversationId, isTyping }` | — (fire and forget) |
| `presence:ping` | — | — (mỗi 60s) |
| `auth:refresh` | `{ token }` | `{ ok }` |

Mọi event ghi dữ liệu đều dùng ack callback để client biết kết quả. `typing` không cần ack và bị throttle 3s/hội thoại phía client, thêm rate limit 1/s phía server.

## 4. Gửi tin nhắn — thứ tự và idempotency

```
1. Client emit `message:send` với `clientMsgId` (UUID sinh tại client).
2. Server kiểm: là participant, không bị block, không vượt rate limit, không bị restrict.
3. Kiểm trùng: tìm message theo (conversationId, clientMsgId).
   Đã có → trả seq cũ trong ack (client gửi lại do mất mạng, không tạo bản sao).
4. Transaction MongoDB:
   a. `findOneAndUpdate(conversation, { $inc: { seqCounter: 1 } })` → seq
   b. insert message với seq đó
   c. cập nhật `conversation.lastMessage`, `updatedAt`
5. Commit → ack `{ seq, createdAt }` cho người gửi.
6. `io.to('conv:{id}').except(senderSockets).emit('message:new', ...)`
7. Với participant không có socket trong room: emit `conversation:updated` vào
   `user:{id}` để cập nhật danh sách hội thoại; nếu offline → đẩy job push notification.
```

`seq` do database cấp phát, đơn điệu tăng theo hội thoại. Client sắp xếp theo `seq`, không theo timestamp — đồng hồ client không đáng tin và độ trễ mạng khác nhau.

Client giữ tin nhắn ở trạng thái `sending` (hiển thị mờ) cho tới khi nhận ack. Ack không về trong 10s → hiện nút "Thử lại", gửi lại với **cùng** `clientMsgId`.

Phát hiện lỗ hổng: khi client thấy `seq` nhảy bậc (nhận seq 42 nhưng đang có 40), nó gọi `GET /conversations/:id/messages?after=40` để lấp — đây là cơ chế tự chữa quan trọng vì `connectionStateRecovery` chỉ phủ được 120s.

### 4.1 Lưu trữ & tải lịch sử

Nguồn sự thật của tin nhắn là MongoDB (`messages`, SPEC-01 §9), không phải Redis pub/sub (chỉ là kênh phát tán, không bền). Redis chỉ giữ trạng thái phù du (presence, rate-limit counter). Do đó realtime chịu được Redis restart mà không mất tin nhắn.

Tải lịch sử qua HTTP, phân trang cursor lùi theo `seq`:
```
GET /conversations/:id/messages?before=<seq>&limit=30   // cuộn lên xem cũ
GET /conversations/:id/messages?after=<seq>&limit=100   // lấp lỗ hổng sau reconnect
```
Client giữ `lastSeq` cục bộ; khi mở lại hội thoại fetch `before` để nạp trang gần nhất, khi reconnect fetch `after` để đồng bộ delta.

### 4.2 Giao tin cho người offline

Bước 7 của luồng gửi tin phân nhánh theo trạng thái người nhận:
- **Có socket trong `conv:{id}`**: nhận `message:new` ngay.
- **Online nhưng không mở hội thoại đó** (có socket ở `user:{id}`): nhận `conversation:updated` để cập nhật badge/danh sách.
- **Offline hoàn toàn**: worker đẩy job `push` vào BullMQ (bền, có retry). Worker đọc `push.devices` (token FCM/APNs, SPEC-02 §9), gửi qua provider, ghi `deliveryReceipt`. Token chết (unregistered) → xoá khỏi `push.devices`. Không có socket nào là nguồn giao tin đảm bảo; đảm bảo đến từ (MongoDB đã commit) + (push queue có retry) + (client fetch `after` khi mở app).

Không dùng Redis pub/sub làm hàng đợi giao tin offline — nó không bền; mọi giao tin cần đảm bảo đều đi qua BullMQ.

## 5. Hiện diện (presence)

Lưu ở Redis: `presence:{userId}` = `{ status, lastSeenAt, socketCount }`, TTL 90s, gia hạn bằng `presence:ping` mỗi 60s. Không lưu ở MongoDB (ghi quá nhiều, giá trị quá ngắn hạn).

Phát tán có kiểm soát: chỉ gửi `presence:update` tới người đang mở hội thoại với user đó, không phát cho toàn bộ follower. Một người có 5.000 follower mà phát cho tất cả mỗi lần online/offline sẽ tạo bão sự kiện.

Tôn trọng quyền riêng tư: user tắt được hiển thị trạng thái online; khi tắt, server trả `status: 'offline'` cho mọi người nhưng vẫn nhận tin nhắn bình thường.

## 6. Scale ngang

Redis adapter (`@socket.io/redis-adapter`) phát tán event giữa các instance qua Redis pub/sub. Mỗi instance chỉ giữ socket của client kết nối tới nó; `io.to(room).emit()` được chuyển tiếp qua Redis tới instance khác.

Sticky session bắt buộc khi bật polling fallback (một client polling phải luôn tới cùng instance). Cấu hình Nginx:

```nginx
upstream api_ws {
    ip_hash;                       # hoặc hash $cookie_io consistent
    server api_1:4000;
    server api_2:4000;
}
location /socket.io/ {
    proxy_pass http://api_ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 70s;        # > pingInterval + pingTimeout
    proxy_send_timeout 70s;
}
```

`proxy_read_timeout` phải lớn hơn `pingInterval + pingTimeout` (45s) nếu không proxy sẽ ngắt kết nối đang khoẻ.

Redis pub/sub không bền (không persist). Nếu Redis restart, một số event đang bay có thể mất — chấp nhận được vì dữ liệu đã ở MongoDB và client tự lấp lỗ hổng bằng `seq`. Không dùng Redis pub/sub như hàng đợi công việc; job dùng BullMQ (có persist).

## 7. Bảo mật realtime

| Nguy cơ | Biện pháp |
|---|---|
| Kết nối không xác thực | Middleware auth ở handshake, không có đường vòng |
| Join room bừa | Server kiểm quyền cho mọi `subscribe`; không chấp nhận tên room từ client |
| Token đã thu hồi vẫn giữ kết nối | Kiểm `tokenVersion` khi handshake và khi `auth:refresh`; khi thu hồi session, server tìm socket theo `userId` và ngắt |
| Spam event | Rate limit theo socket: 100 event/10s tổng, `message:send` 50/phút, `typing` 1/s. Vượt → cảnh báo, vượt tiếp → ngắt kết nối 5 phút |
| Payload lớn | `maxHttpBufferSize: 1MB`; attachment không đi qua socket, chỉ gửi key sau khi upload S3 |
| Nội dung XSS qua tin nhắn | Sanitize ở server trước khi lưu và trước khi phát; client render dạng text |
| Amplification | Không có event nào cho phép client phát tán tới room mà nó không thuộc |
| Rò rỉ qua CORS | `cors.origin` là allowlist tường minh, không phản chiếu Origin |

## 8. Client (Next.js)

Một instance socket duy nhất toàn ứng dụng, đặt trong React context. Tự reconnect với backoff (`reconnectionDelay: 1000`, `reconnectionDelayMax: 10_000`, không giới hạn số lần). Khi reconnect: gọi lại `conv:subscribe` cho hội thoại đang mở, sau đó fetch tin nhắn `after=lastSeq` để lấp lỗ hổng.

Hiển thị trạng thái kết nối: chỉ hiện banner "Đang kết nối lại…" sau 3s mất kết nối để tránh nhấp nháy khi mạng chớp tắt.

Không dùng socket cho dữ liệu ban đầu — luôn fetch bằng HTTP rồi mới lắng nghe cập nhật. Socket chỉ để đồng bộ delta.

## 9. Giám sát

Metric: `socketio_connections` (gauge, theo instance), `socketio_events_total{event,direction}`, `socketio_event_duration_ms{event}`, `socketio_auth_failures_total{reason}`, `socketio_rate_limited_total`, `redis_adapter_publish_errors_total`, `message_delivery_latency_ms` (từ lúc commit DB tới lúc emit).

Alert: kết nối giảm > 40% trong 5 phút (dấu hiệu proxy hoặc adapter lỗi), tỷ lệ auth failure tăng vọt, độ trễ gửi tin p95 > 1s, lỗi publish Redis > 0.

Load test bằng `artillery` với engine socket.io: mô phỏng 5.000 kết nối đồng thời, 20% đang trong hội thoại hoạt động, mục tiêu p95 gửi→nhận ≤ 500ms và không rò rỉ bộ nhớ sau 30 phút.
