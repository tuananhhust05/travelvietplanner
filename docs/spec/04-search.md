# SPEC-04 — Tìm kiếm (Elasticsearch 8)

MongoDB là nguồn sự thật; Elasticsearch là chỉ mục phái sinh, có thể xoá và rebuild hoàn toàn.

## 1. Phân tích tiếng Việt

Vấn đề: tiếng Việt có dấu, người dùng thường gõ không dấu ("da nang", "ha long"), và tách từ theo âm tiết chứ không theo khoảng trắng ngữ nghĩa ("Đà Nẵng" là một thực thể hai âm tiết).

Giải pháp v1: **ICU + folding + shingle**, không dùng plugin word-segmentation bên thứ ba (giảm rủi ro vận hành, plugin vi_analyzer không được cập nhật đều theo bản ES).

```json
{
  "settings": {
    "index": { "number_of_shards": 1, "number_of_replicas": 1,
               "max_ngram_diff": 18 },
    "analysis": {
      "char_filter": {
        "vn_normalize": { "type": "mapping",
          "mappings": ["đ => d", "Đ => D"] }
      },
      "filter": {
        "vn_fold":     { "type": "icu_folding" },
        "vn_stop":     { "type": "stop", "stopwords": ["và","của","các","là","cho","với","tại","the","a","an","of"] },
        "edge_2_18":   { "type": "edge_ngram", "min_gram": 2, "max_gram": 18 },
        "vn_shingle":  { "type": "shingle", "min_shingle_size": 2, "max_shingle_size": 3,
                         "output_unigrams": true }
      },
      "analyzer": {
        "vi_text":        { "tokenizer": "icu_tokenizer",
                            "char_filter": ["vn_normalize"],
                            "filter": ["lowercase", "vn_fold", "vn_stop", "vn_shingle"] },
        "vi_text_search": { "tokenizer": "icu_tokenizer",
                            "char_filter": ["vn_normalize"],
                            "filter": ["lowercase", "vn_fold", "vn_stop"] },
        "vi_autocomplete":{ "tokenizer": "icu_tokenizer",
                            "char_filter": ["vn_normalize"],
                            "filter": ["lowercase", "vn_fold", "edge_2_18"] },
        "vi_exact":       { "tokenizer": "keyword",
                            "char_filter": ["vn_normalize"],
                            "filter": ["lowercase", "vn_fold"] }
      },
      "normalizer": {
        "vn_keyword": { "char_filter": ["vn_normalize"], "filter": ["lowercase", "vn_fold"] }
      }
    }
  }
}
```

Vì sao `vi_text` có shingle mà `vi_text_search` không: shingle ở index-time cho phép khớp cụm 2–3 âm tiết ("đà nẵng", "vịnh hạ long") với điểm cao hơn từ đơn lẻ; ở search-time không cần shingle vì `match_phrase` đã xử lý cụm.

`icu_folding` bỏ dấu nên "Đà Nẵng" → "da nang", đáp ứng yêu cầu tìm không dấu. Trường `*.raw` giữ nguyên bản gốc cho hiển thị.

## 2. Index & alias

| Alias (đọc/ghi) | Index thật | Nội dung |
|---|---|---|
| `tvp_posts` | `tvp_posts_v1` | Bài viết đã publish |
| `tvp_users` | `tvp_users_v1` | Hồ sơ user công khai (gồm guide) |
| `tvp_orgs` | `tvp_orgs_v1` | Agency + business |
| `tvp_places` | `tvp_places_v1` | Địa điểm published |
| `tvp_tours` | `tvp_tours_v1` | Tour published của org verified |
| `tvp_listings` | `tvp_listings_v1` | Listing published |

Mọi truy vấn dùng alias. Reindex theo mô hình blue/green: tạo `_v2` → reindex → kiểm tra → `POST /_aliases` đổi atomically → xoá `_v1` sau 7 ngày.

## 3. Mapping

### 3.1 tvp_posts

```json
{
  "properties": {
    "id":        { "type": "keyword" },
    "type":      { "type": "keyword" },
    "body":      { "type": "text", "analyzer": "vi_text", "search_analyzer": "vi_text_search",
                   "fields": { "raw": { "type": "text", "analyzer": "standard" } } },
    "lang":      { "type": "keyword" },
    "author":    { "properties": {
                     "kind": { "type": "keyword" }, "userId": { "type": "keyword" },
                     "orgId": { "type": "keyword" },
                     "displayName": { "type": "text", "analyzer": "vi_text",
                                      "fields": { "kw": { "type": "keyword", "normalizer": "vn_keyword" } } },
                     "handle": { "type": "keyword" }, "verified": { "type": "boolean" },
                     "trustScore": { "type": "short" } } },
    "placeId":   { "type": "keyword" },
    "placePath": { "type": "keyword" },
    "placeName": { "type": "text", "analyzer": "vi_text" },
    "geo":       { "type": "geo_point" },
    "tags":      { "type": "keyword", "normalizer": "vn_keyword" },
    "rating":    { "type": "byte" },
    "hasImage":  { "type": "boolean" },
    "hasVideo":  { "type": "boolean" },
    "visibility":{ "type": "keyword" },
    "moderationState": { "type": "keyword" },
    "counters":  { "properties": { "reactions": {"type":"integer"}, "comments": {"type":"integer"},
                                   "shares": {"type":"integer"}, "views": {"type":"integer"} } },
    "engagementScore": { "type": "float" },
    "publishedAt": { "type": "date" },
    "updatedAt":   { "type": "date" }
  }
}
```

`placePath` chứa toàn bộ ancestor ID → tìm "miền Trung" ra bài ở Đà Nẵng, Hội An, Huế bằng một `terms` filter, không cần join.

### 3.2 tvp_places · tvp_orgs · tvp_users (rút gọn)

```json
// places
{ "name_vi": {"type":"text","analyzer":"vi_text","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete","search_analyzer":"vi_text_search"}}},
  "name_en": {"type":"text","analyzer":"english","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete","search_analyzer":"vi_text_search"}}},
  "aliases": {"type":"text","analyzer":"vi_text"},
  "type": {"type":"keyword"}, "ancestors": {"type":"keyword"},
  "geo": {"type":"geo_point"}, "popularity": {"type":"float"},
  "stats": {"properties":{"postCount":{"type":"integer"},"ratingAvg":{"type":"half_float"}}} }

// orgs
{ "name": {"type":"text","analyzer":"vi_text","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete"},
                                                        "kw":{"type":"keyword","normalizer":"vn_keyword"}}},
  "type": {"type":"keyword"}, "businessType": {"type":"keyword"},
  "description": {"type":"text","analyzer":"vi_text"},
  "serviceAreas": {"type":"keyword"}, "provinceId": {"type":"keyword"},
  "geo": {"type":"geo_point"}, "verified": {"type":"boolean"},
  "priceMin": {"type":"integer"}, "priceMax": {"type":"integer"},
  "rating": {"properties":{"avg":{"type":"half_float"},"count":{"type":"integer"}}},
  "amenities": {"type":"keyword"}, "status": {"type":"keyword"} }

// users
{ "handle": {"type":"keyword","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete"}}},
  "displayName": {"type":"text","analyzer":"vi_text","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete"}}},
  "bio": {"type":"text","analyzer":"vi_text"},
  "accountType": {"type":"keyword"}, "isGuide": {"type":"boolean"},
  "guide": {"properties":{"verified":{"type":"boolean"},"languages":{"type":"keyword"},
                          "regions":{"type":"keyword"},"specialties":{"type":"keyword"},
                          "dayRate":{"type":"integer"},"ratingAvg":{"type":"half_float"}}},
  "followerCount": {"type":"integer"}, "profileVisibility": {"type":"keyword"},
  "status": {"type":"keyword"} }
```

### 3.3 tvp_tours · tvp_listings

```json
// tours (làm giàu từ tours + org verified)
{ "id": {"type":"keyword"}, "orgId": {"type":"keyword"},
  "title_vi": {"type":"text","analyzer":"vi_text","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete","search_analyzer":"vi_text_search"}}},
  "title_en": {"type":"text","analyzer":"english","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete","search_analyzer":"vi_text_search"}}},
  "summary_vi": {"type":"text","analyzer":"vi_text"}, "summary_en": {"type":"text","analyzer":"english"},
  "destinations": {"type":"keyword"}, "destinationPath": {"type":"keyword"},
  "destinationNames": {"type":"text","analyzer":"vi_text"},
  "durationDays": {"type":"byte"}, "durationNights": {"type":"byte"},
  "priceMin": {"type":"integer"}, "priceMax": {"type":"integer"},
  "seasons": {"type":"byte"}, "tags": {"type":"keyword","normalizer":"vn_keyword"},
  "org": {"properties":{"name":{"type":"text","analyzer":"vi_text"},"verified":{"type":"boolean"},
                        "ratingAvg":{"type":"half_float"}}},
  "counters": {"properties":{"views":{"type":"integer"},"inquiries":{"type":"integer"}}},
  "status": {"type":"keyword"}, "publishedAt": {"type":"date"}, "updatedAt": {"type":"date"} }

// listings
{ "id": {"type":"keyword"}, "orgId": {"type":"keyword"}, "kind": {"type":"keyword"},
  "name_vi": {"type":"text","analyzer":"vi_text","fields":{"ac":{"type":"text","analyzer":"vi_autocomplete","search_analyzer":"vi_text_search"}}},
  "name_en": {"type":"text","analyzer":"english"},
  "description": {"type":"text","analyzer":"vi_text"},
  "price": {"type":"integer"}, "priceUnit": {"type":"keyword"},
  "capacityAdults": {"type":"byte"}, "capacityChildren": {"type":"byte"},
  "amenities": {"type":"keyword"},
  "org": {"properties":{"name":{"type":"text","analyzer":"vi_text"},"provinceId":{"type":"keyword"},
                        "serviceAreas":{"type":"keyword"},"geo":{"type":"geo_point"},
                        "verified":{"type":"boolean"},"ratingAvg":{"type":"half_float"}}},
  "status": {"type":"keyword"}, "publishedAt": {"type":"date"}, "updatedAt": {"type":"date"} }
```

Lưu ý làm giàu (enrichment) khi đồng bộ: tour giữ `destinationPath` (toàn bộ ancestor ID của điểm đến, giống `placePath` ở posts) để lọc "tour miền Trung" bằng một `terms`; `priceMin/priceMax` được tính từ mảng `pricing[]`/`departures[]` ở MongoDB tại thời điểm index. Chỉ index tour/listing của org đã `verified` và `status='published'`.

### 3.4 Không index vào ES

Không index vào ES: email, số điện thoại, nội dung tin nhắn, giấy tờ, nội dung `private`. ES không có kiểm soát truy cập ở cấp document nên nguyên tắc là chỉ đưa vào những gì có thể công khai; dữ liệu `followers`-only được index kèm `visibility` và luôn lọc ở query.

## 4. Truy vấn

### 4.1 Tìm bài viết

```json
{
  "query": {
    "bool": {
      "must": [{
        "multi_match": {
          "query": "<q>", "type": "best_fields", "operator": "and",
          "fields": ["body^3", "tags^4", "placeName^2", "author.displayName^1.5"],
          "fuzziness": "AUTO:5,8", "prefix_length": 1
        }
      }],
      "filter": [
        { "term":  { "moderationState": "ok" } },
        { "terms": { "visibility": ["public"] } },
        { "terms": { "type": ["story","review","question"] } },
        { "terms": { "placePath": ["<placeId>"] } },
        { "range": { "publishedAt": { "gte": "now-1y" } } }
      ],
      "must_not": [
        { "terms": { "author.userId": ["<blocked ids>"] } }
      ],
      "should": [
        { "match_phrase": { "body": { "query": "<q>", "boost": 3 } } },
        { "term": { "author.verified": { "value": true, "boost": 1.3 } } }
      ]
    }
  },
  "sort": ["_score", { "publishedAt": "desc" }],
  "highlight": { "fields": { "body": { "fragment_size": 160, "number_of_fragments": 2 } } },
  "track_total_hits": 1000
}
```

`fuzziness: AUTO:5,8` — chỉ cho phép sai chính tả với từ ≥5 ký tự; tiếng Việt nhiều từ 2–4 ký tự nên fuzzy quá rộng sẽ tạo nhiễu nặng. `operator: and` để truy vấn nhiều từ không trả về kết quả chỉ khớp một từ.

Xếp hạng bổ sung bằng `function_score` cho tab "liên quan nhất": nhân điểm với `log1p(engagementScore)` (weight 0.3) và suy giảm thời gian `gauss(publishedAt, scale=30d, decay=0.5)` (weight 0.2).

`track_total_hits: 1000` — không đếm chính xác quá 1000 để tiết kiệm; UI hiển thị "1000+".

### 4.2 Autocomplete

Một truy vấn `_msearch` gộp 4 index (places, orgs, users, tags), mỗi index `size: 5`, chỉ dùng trường `.ac`, `_source` giới hạn 3–4 trường, không highlight. Cache Redis theo `(q, lang)` TTL 5 phút. Mục tiêu p95 100ms.

### 4.3 Tìm nhà cung cấp có filter

Filter thường dùng: `verified: true`, `status: active`, `serviceAreas`/`provinceId`, `businessType`, khoảng giá (`priceMin <= max AND priceMax >= min`), `amenities` (terms AND), `rating.avg >= x`, `geo_distance` khi có toạ độ.

Sắp xếp: `_score` | `rating.avg desc` | `priceMin asc` | `_geo_distance asc`.

Aggregation cho facet: `terms` trên `businessType`, `amenities`, `provinceId`; `range` trên giá; `stats` trên rating. Trả kèm số lượng để UI hiện "(24)".

### 4.4 Guide còn trống

ES trả tập ứng viên theo `regions`, `languages`, `specialties`, `dayRate`, `verified`; lịch trống kiểm tra ở MongoDB (`availability`) vì thay đổi liên tục và cần chính xác tuyệt đối. ES lọc thô, MongoDB lọc tinh — không index dữ liệu biến động cao vào ES.

## 5. Đồng bộ dữ liệu (outbox pattern)

Không dùng Change Streams làm cơ chế chính: cần retry có kiểm soát, cần biến đổi dữ liệu (làm giàu thêm placePath, author info), và cần thứ tự đảm bảo theo document.

```
1. api ghi Post + chèn outbox { aggregate:'post', aggregateId, op:'upsert' }
   → trong CÙNG một MongoDB transaction. Không có ghi nào lọt ra ngoài.
2. worker `indexer` poll outbox: status='pending' AND availableAt<=now,
   lấy theo lô 200, đánh dấu 'processing' bằng findOneAndUpdate (chống trùng worker).
3. Với mỗi item: đọc bản mới nhất từ MongoDB → biến đổi sang ES document
   (làm giàu: author.displayName, author.verified, placePath từ ancestors) → bulk upsert.
4. Bulk thành công → status='done'. Lỗi từng item → attempts++,
   availableAt = now + 2^attempts giây (tối đa 1 giờ). attempts>=8 → 'failed' + cảnh báo.
5. Job dọn: xoá outbox 'done' cũ hơn 7 ngày.
```

Thứ tự: dùng `external_gte` versioning với `version = updatedAt.getTime()` để bản cũ không ghi đè bản mới khi xử lý lệch thứ tự.

Trễ mục tiêu: p95 ≤ 3s từ publish tới tìm thấy. Đo bằng metric `outbox_lag_seconds` (thời điểm hiện tại − `createdAt` của item pending cũ nhất); alert khi > 30s.

### 5.1 Rebuild toàn bộ

Script `infra/scripts/es-reindex.ts`: tạo index `_vN+1` với mapping mới → scroll toàn bộ MongoDB theo collection, bulk index 1000 doc/lô (song song 4 luồng) → so số lượng document → kiểm tra bộ truy vấn mẫu → đổi alias → giữ index cũ 7 ngày. Ước tính: 1 triệu post ≈ 20 phút. Trong lúc rebuild, `_v1` vẫn phục vụ đọc bình thường.

## 6. Xoá dữ liệu

Xoá post/user → outbox `op: 'delete'` → `DELETE /tvp_posts/_doc/:id`. Xoá tài khoản (GDPR/NĐ13): xoá mọi document của user ở `tvp_users`, `tvp_posts`, và cập nhật `author` trong bài của người khác nếu có mention. Có script kiểm chứng `verify-erasure.ts` truy vấn ES để chắc không còn dấu vết PII.

## 7. Vận hành

| Hạng mục | Cấu hình |
|---|---|
| Dev | 1 node, `discovery.type=single-node`, 1GB heap, security bật với mật khẩu |
| Production | 3 node (master-eligible), 1 shard + 1 replica mỗi index, heap = 50% RAM và ≤ 31GB |
| Bảo mật | X-Pack security bật, TLS nội bộ cluster, user riêng cho `api` (chỉ read) và `worker` (read/write), không expose port ra ngoài |
| Snapshot | Không cần (rebuild từ MongoDB). Vẫn snapshot tuần để phục hồi nhanh |
| ILM | `tvp_posts` không rollover ở v1 (dữ liệu chưa lớn); theo dõi và bật khi > 50GB |
| Monitoring | Cluster health, JVM heap, search latency p95, indexing rate, rejected thread |
| Circuit breaker | Alert khi `parent` breaker trip; giới hạn `size` ≤ 50, `from` ≤ 1000 (dùng `search_after` cho phân trang sâu) |

Suy giảm khi ES lỗi: `api` bắt lỗi, ghi metric, chuyển sang truy vấn MongoDB với `$regex` trên trường name/title (giới hạn 20 kết quả, chỉ tìm theo tiền tố), và trả `meta.degraded: true` để UI hiện banner. Không trả 500 cho người dùng vì tìm kiếm không phải chức năng sống-còn.
