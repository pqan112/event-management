# Next.js Cache Components Guide

## Giới thiệu

Cache Components là tính năng mới của Next.js (từ phiên bản 13+) cho phép bạn cache kết quả render của component/function server-side một cách tự động và hiệu quả. Thay vì cache chỉ ở mức HTTP request (fetch), Cache Components cache cả quá trình xử lý: DB query, transform data, render JSX.

**Trong project này**: `cacheComponents: true` đã được bật ở `next.config.ts`, và áp dụng ở 2 components chính: `EventList` và `EventDetailsCached`.

---

## 1. Khái niệm cơ bản

### `"use cache"` directive

`"use cache"` là một directive đánh dấu function/component là **cacheable**. Khi Next.js gặp nó:

1. Chạy function một lần
2. Cache lại **output** (HTML/data render ra)
3. Lần sau gọi với **cùng input** → trả từ cache, không chạy lại

```tsx
async function EventList() {
  "use cache"; // Mark this component as cacheable
  
  const events = await getEvents(); // DB query
  return <ul>{events.map(e => <li>{e.title}</li>)}</ul>; // JSX render
}
```

Lần đầu gọi `EventList()`: chạy full → cache kết quả HTML.
Lần thứ 2, 3, ... gọi `EventList()`: trả HTML từ cache (không gọi DB lại).

### Cache Key

Cache key được tính từ:
- **Code của function** — nếu bạn sửa code, cache invalidate tự động
- **Arguments truyền vào** — phải là giá trị serializable (như JSON)

Ví dụ:
```tsx
async function EventDetailsCached({ slug }: { slug: string }) {
  "use cache";
  const event = await getEventBySlug(slug);
  return <div>{event.title}</div>;
}
```

- `EventDetailsCached("react-conf")` → 1 cache entry
- `EventDetailsCached("node-summit")` → 1 cache entry riêng (slug khác)

---

## 2. `cacheLife` — Cache theo thời gian

`cacheLife` kiểm soát **khi nào cache hết hạn**, gồm 3 mốc thời gian:

### Cấu trúc

```ts
// next.config.ts
cacheLife: {
  event: {
    stale: 800,       // seconds
    revalidate: 900,  // seconds
    expire: 86400,    // seconds
  }
}
```

### 3 giai đoạn

| Giai đoạn | Khoảng thời gian | Hành động |
|---|---|---|
| **Fresh (Stale)** | 0 → 13.3 phút | Trả cache ngay, **không** check server |
| **Stale** | 13.3 → 15 phút | Trả cache cũ ngay, nhưng **chạy lại ở background** (stale-while-revalidate) |
| **Expired** | > 15 phút | **Buộc chạy lại** function, không được trả cache cũ |

### Ví dụ timeline

```
Lúc 00:00 — EventList() được gọi lần đầu
  → Chạy getEvents(), cache kết quả

Lúc 00:05 — Ai đó truy cập trang chủ
  → Trả cache ngay (trong giai đoạn "fresh")
  
Lúc 00:14 — Ai đó tạo event mới, reload
  → Trả cache cũ (vẫn trong stale), nhưng âm thầm chạy getEvents() ở background
  → Event mới sẽ xuất hiện lần **sau** khi refresh

Lúc 00:16 — Ai đó refresh lại
  → Cache đã hết hạn (expire) → bắt buộc chạy getEvents() lại
  → Event mới xuất hiện ngay
```

**Nhược điểm của time-based cache**: phải chờ đến 15 phút mới cập nhật ngay lập tức.

---

## 3. `cacheTag` + `revalidateTag` — Cache theo sự kiện (On-demand)

`cacheTag` gắn một **nhãn** vào cache entry. Khi bạn gọi `revalidateTag(tag)` ở bất kỳ đâu (route handler, server action) ngay sau mutation, Next.js **xoá cache entry đó ngay lập tức** — không cần chờ.

### Ví dụ: tạo event mới

```tsx
// Gắn tag vào cache entry
async function EventList() {
  "use cache";
  cacheLife("event");
  cacheTag("events"); // ← Tag này
  
  return <ul>{events}</ul>;
}

// Khi tạo event mới:
// app/api/events/route.ts
export async function POST(req: NextRequest) {
  const event = await Event.create({...});
  
  revalidateTag("events"); // ← Xoá cache ngay
  return NextResponse.json({...}, { status: 201 });
}
```

**Timeline**:
```
Lúc 00:00 — EventList render, cache tag="events"
Lúc 00:05 — User tạo event mới qua POST /api/events
  → revalidateTag("events") được gọi
  → Cache entry có tag "events" bị xoá **ngay lập tức**
Lúc 00:05 — User refresh trang chủ
  → Cache đã xoá, buộc chạy getEvents() lại
  → Event mới xuất hiện ngay (không phải chờ 15 phút)
```

### `cacheTag` vs `cacheLife` — khi nào dùng cái nào

| Tình huống | Dùng |
|---|---|
| Data không bao giờ thay đổi (static) | Chỉ `cacheLife` (time-based là đủ) |
| Data thay đổi nhưng hiếm, chấp nhận stale 15 phút | Chỉ `cacheLife` |
| Data thay đổi thường xuyên, muốn cập nhật ngay | `cacheTag` + `revalidateTag` |
| Muốn cả time-based fallback + on-demand invalidation | Dùng cả 2 (bạn đó là bạn) |

---

## 4. Thiết kế tag strategy ở project

```
EventList  ← tag: "events"
EventDetailsCached (react-conf)  ← tag: "event-react-conf"
EventDetailsCached (node-summit)  ← tag: "event-node-summit"
```

### Tại sao tách thành 2 tag?

Tạo event mới → `revalidateTag("events")` → xoá cache của `EventList` (cập nhật danh sách ngay).

Nhưng các trang detail (`/events/react-conf`, `/events/node-summit`) **không** subscribe tag `"events"` → vẫn cache, không bị invalidate không cần thiết.

Nếu sau này người dùng chỉnh sửa event `react-conf` → `revalidateTag("event-react-conf")` → chỉ trang detail đó cập nhật, không ảnh hưởng danh sách hay các event khác.

---

## 5. `<Suspense>` — tại sao cần bọc xung quanh cached components?

Cache Components hoạt động cùng **Partial Prerendering (PPR)**: Next.js prerender phần tĩnh ra HTML sẵn, còn phần động (DB query, cache miss, dynamic APIs) thì stream sau.

`<Suspense>` giúp React biết:
- **Fallback**: hiển thị cái gì trong khi chờ component render xong
- **Streaming boundary**: phần này stream sau, phần này có sẵn

```tsx
// app/page.tsx
export default async function Page() {
  return (
    <section>
      <h1>Event Manager</h1> {/* Static, prerender sẵn */}
      
      <Suspense fallback={<p>Loading events...</p>}>
        <EventList /> {/* Dynamic (cached), stream sau */}
      </Suspense>
    </section>
  );
}
```

**Nếu thiếu `<Suspense>`**: Next.js build lỗi (nếu component dùng `cookies()`, `headers()`, `searchParams`) hoặc warning.

---

## 6. Kiến trúc dữ liệu trong project

```
Server Layer (lib/actions/)
├─ getEvents()           → connectDB → Event.find()
├─ getEventBySlug(slug)  → connectDB → Event.findOne()
└─ getSimilarEventsBySlug(slug)

Component Layer
├─ EventList (cached with tag="events")
│  └─ calls getEvents()
│
└─ EventDetailsCached (cached with tag="event-${slug}")
   ├─ calls getEventBySlug(slug)
   └─ calls getSimilarEventsBySlug(slug)

Page Layer (with <Suspense>)
├─ app/page.tsx
│  └─ wraps <EventList /> in <Suspense>
│
└─ app/events/[slug]/page.tsx
   └─ wraps <EventDetails /> in <Suspense>

API Layer (Mutation)
└─ app/api/events/route.ts
   └─ POST: Event.create() + revalidateTag("events")
```

**Luồng dữ liệu**:
1. User vào trang chủ
2. Page render → Suspense fallback hiển thị
3. Server chạy `EventList` → gọi `getEvents()` → DB query → cache với tag `"events"`
4. HTML trả về, Suspense fallback ẩn
5. User tạo event mới qua POST `/api/events`
6. Route handler gọi `revalidateTag("events")` → cache xoá
7. User reload trang chủ
8. `EventList` cache miss → chạy lại `getEvents()` → fetch mới từ DB → event mới xuất hiện

---

## 7. Lỗi hay gặp & cách tránh

### ❌ Lỗi 1: Mix 2 cơ chế cache

```tsx
// ❌ SAI
const EventDetailsCached = async ({ slug }: { slug: string }) => {
  "use cache";
  cacheLife("event");
  
  const request = await fetch(`/api/events/${slug}`, {
    next: { revalidate: 60 } // Cache cũ
  });
  // ...
};
```

**Tại sao sai**: `fetch().next.revalidate` (ISR cũ) + `cacheLife` (cache mới) chồng chéo, gây nhầm lẫn. Chỉ chọn 1 cơ chế.

```tsx
// ✅ ĐÚNG
const EventDetailsCached = async ({ slug }: { slug: string }) => {
  "use cache";
  cacheLife("event");
  cacheTag(`event-${slug}`);
  
  const event = await getEventBySlug(slug); // Gọi server action trực tiếp
  // ...
};
```

### ❌ Lỗi 2: Tự fetch vào API của chính mình

```tsx
// ❌ SAI
const event = await fetch(`${BASE_URL}/api/events/${slug}`).then(r => r.json());
```

**Tại sao sai**: Server component đã ở server, gọi fetch vào API route của chính server mình là vòng quanh không cần thiết — tốn request network, chậm, dễ lỗi.

```tsx
// ✅ ĐÚNG
const event = await getEventBySlug(slug); // Call DB trực tiếp
```

### ❌ Lỗi 3: Quên `<Suspense>` bao ngoài component cached

```tsx
// ❌ SAI
export default async function Page() {
  return (
    <section>
      <EventList /> {/* Cached component, nhưng không có Suspense */}
    </section>
  );
}
```

**Tại sao sai**: Nếu `EventList` cache miss, phải chạy lại → chờ DB query → trang chủ block cho đến khi done. Không streaming, không progressive enhancement.

```tsx
// ✅ ĐÚNG
export default async function Page() {
  return (
    <section>
      <Suspense fallback={<p>Loading...</p>}>
        <EventList />
      </Suspense>
    </section>
  );
}
```

### ❌ Lỗi 4: Quên `revalidateTag` sau mutation

```tsx
// ❌ SAI
export async function POST(req: NextRequest) {
  const event = await Event.create({...});
  return NextResponse.json({...}); // Cache không biết data đổi
}
```

**Tại sao sai**: Cache vẫn trả stale data, user phải chờ 15 phút (revalidate period) hoặc 1 ngày (expire) mới thấy dữ liệu mới.

```tsx
// ✅ ĐÚNG
import { revalidateTag } from "next/cache";

export async function POST(req: NextRequest) {
  const event = await Event.create({...});
  revalidateTag("events"); // Xoá cache ngay
  return NextResponse.json({...});
}
```

### ❌ Lỗi 5: Dùng `cookies()` / `headers()` / `searchParams` bên trong `"use cache"`

```tsx
// ❌ SAI
const MyComponent = async () => {
  "use cache";
  cacheLife("myData");
  
  const authToken = (await cookies()).get("auth")?.value; // ❌ Lỗi build
  // ...
};
```

**Tại sao sai**: `cookies()` là dynamic (khác per-request), không thể cache. Cache Components yêu cầu pure function (input → output không thay đổi).

```tsx
// ✅ ĐÚNG
const MyPage = async () => {
  const authToken = (await cookies()).get("auth")?.value; // Dynamic API ở ngoài cache
  
  return (
    <section>
      <Suspense fallback={<p>Loading...</p>}>
        <CachedComponent token={authToken} />
      </Suspense>
    </section>
  );
};

const CachedComponent = async ({ token }: { token: string }) => {
  "use cache";
  cacheLife("data");
  // Giờ input (token) là static (đã serialize), có thể cache
  // ...
};
```

---

## 8. Serialization — `JSON.parse(JSON.stringify(...))`

Cache entry phải là **JSON-serializable** (giống các argument function). Nếu return `Date`, `ObjectId`, hay Mongoose document trực tiếp → error hoặc silent failure.

```tsx
// ❌ SAI
export const getEventBySlug = async (slug: string) => {
  const event = await Event.findOne({ slug }).lean();
  return event; // ObjectId sẽ toasted, Date không serialize đúng
};

// ✅ ĐÚNG
export const getEventBySlug = async (slug: string) => {
  const event = await Event.findOne({ slug }).lean();
  return JSON.parse(JSON.stringify(event)); // Serialize, remove non-JSON fields
};
```

**Quy ước**: Tất cả server actions gọi từ cached components phải return serialized data.

---

## 9. Debugging & Monitoring

### Kiểm tra cache đang hoạt động không?

1. **Build output**: `npm run build`
   ```
   Route (app)             Revalidate  Expire
   ┌ ○ /                          15m      1d   ← Cached
   └ ◐ /events/[slug]                          ← Partial Prerender
   ```

2. **Dev mode**: `npm run dev`
   - Khi truy cập trang, Next.js log: `"use cache"` hit/miss
   - Cache file lưu ở `.next/cache`

3. **Clear cache**: `rm -rf .next/cache` rồi dev lại

### Test invalidation

```bash
# Terminal 1
npm run dev

# Terminal 2 — tạo event mới
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"New Event","...":"..."}'

# Terminal 1 — kiểm tra log
# Sẽ thấy "revalidateTag('events')" được ghi
```

---

## 10. Khi nào nên dùng Cache Components?

### ✅ Phù hợp

- Data không thay đổi thường xuyên (events, blog posts, products)
- Query DB có overhead cao (complex joins, aggregations)
- Nhiều users truy cập cùng lúc (cache giảm load DB)
- Hệ thống có data freshness tolerance (ok nếu stale vài phút)

### ❌ Không phù hợp

- Dữ liệu user-specific (profile, wishlist, cart) — mỗi user khác nhau
- Data thay đổi mỗi giây (real-time chat, live score)
- Phải có immediate consistency (booking seat — không được double-book)

**Project hiện tại**: events & details → **phù hợp** (event metadata ít khi thay đổi, user có thể chấp nhận stale 15 phút).

---

## 11. Tổng kết: Next.js Cache Components Workflow

```
┌─────────────────────────────────────────┐
│  next.config.ts                         │
│  cacheComponents: true                  │
│  cacheLife: { event: {...} }            │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Cached Component                       │
│  "use cache"                            │
│  cacheLife("event")                     │
│  cacheTag("events")                     │
│  → getEvents() / getEventBySlug()       │
└─────────────────────────────────────────┘
           ↓
    ┌──────────────────┐
    │  Cache Entry     │
    │  key: code+args  │
    │  value: HTML     │
    │  stale: 13.3min  │
    │  revalidate: 15m │
    │  expire: 1 day   │
    │  tags: [...]     │
    └──────────────────┘
           ↓
    ┌──────────────────────────────┐
    │  Request đến trang           │
    │  → Cache hit? Trả ngay       │
    │  → Cache miss? Chạy function │
    └──────────────────────────────┘
           ↓
    ┌──────────────────────────────┐
    │  Mutation (POST/PUT/DELETE)  │
    │  → revalidateTag(...)        │
    │  → Cache xoá ngay            │
    └──────────────────────────────┘
           ↓
    Lần request tiếp theo → cache miss → cập nhật data
```

---

## Tham khảo & Resources

- [Next.js Docs — Cache Components](https://nextjs.org/docs/app/building-your-application/caching#react-cache-components) (khi Next.js docs cập nhật)
- [Next.js Docs — cacheLife](https://nextjs.org/docs/app/api-reference/next-config-js/cacheLife)
- [React Server Components — Streaming UI](https://react.dev/reference/react/Suspense)
- Project files:
  - `next.config.ts` — config
  - `lib/actions/event.actions.ts` — server actions
  - `components/EventList.tsx`, `components/EventDetails.tsx` — cached components
  - `app/api/events/route.ts` — mutation endpoint
