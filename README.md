# 🔔 Intelligent Notification System

> A production-grade, event-driven notification platform built to demonstrate **how large-scale social platforms protect their databases** from write-heavy operations like viral likes and comments. Uses the same architectural patterns as Instagram, YouTube, and Twitter.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=flat&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](https://redis.io/)

---

## 📋 Platform Features

This is a **fully functional social media platform** built as a foundation to showcase the notification architecture:

- **User Authentication** — Register, Login with JWT access tokens + refresh tokens, bcrypt password hashing
- **Post Creation** — Users can create text posts visible to all other users
- **Follow System** — Follow/Unfollow other users; Bell subscriptions (YouTube-style) for priority notifications
- **Like System** — Like/Unlike posts with real-time count updates
- **Comment System** — Comment on posts with nested reply support
- **User Search** — Search for users by username across the platform
- **Real-time Notifications** — WebSocket-powered instant notification delivery via Socket.IO

> **Important**: The core purpose of this project is NOT just social media features — it is to demonstrate **how to architect a notification system that can handle millions of concurrent events without killing your database**.

---

## 🏗️ Architecture Overview

The system is built as a **microservices architecture** with 5 independent services, connected via Apache Kafka as the central message bus.

```
┌───────────────────────────────────────────────────────────────────────┐
│                         React Frontend (Vite)                         │
│  ┌──────────┐ ┌──────────────┐ ┌───────────────┐ ┌───────────────┐   │
│  │ Post Feed│ │ Post Tester  │ │ Database      │ │ System        │   │
│  │          │ │ (Sim Dials)  │ │ Viewer        │ │ Dashboard     │   │
│  └──────────┘ └──────────────┘ └───────────────┘ └───────────────┘   │
└────────────────────────┬──────────────────────────────────────────────┘
                         │ HTTP + WebSocket
        ┌────────────────┼────────────────────┐
        ▼                ▼                    ▼
┌──────────────┐ ┌──────────────┐    ┌──────────────┐
│  Social API  │ │  Ingestion   │    │   Socket     │
│  (Port 3003) │ │  Service     │    │   Service    │
│              │ │  (Port 3000) │    │  (Port 4000) │
│  Posts,Likes │ │  Kafka Prod  │    │  WebSocket   │
│  Comments    │ │  + Fallback  │    │  Delivery    │
│  Follows     │ │  Queue       │    │              │
└──────┬───────┘ └──────┬───────┘    └──────▲───────┘
       │                │                    │
       │                ▼                    │
       │     ┌─────────────────────┐         │
       │     │    Apache Kafka     │         │
       │     │  ┌───────────────┐  │         │
       │     │  │ critical-     │  │         │
       │     │  │ notifications │  │         │
       │     │  ├───────────────┤  │         │
       │     │  │ high-priority │  │         │
       │     │  │ notifications │  │         │
       │     │  ├───────────────┤  │         │
       │     │  │ low-priority  │  │         │
       │     │  │ notifications │  │         │
       │     │  ├───────────────┤  │         │
       │     │  │ ready-        │  │  Kafka  │
       │     │  │ notifications │──┼─────────┘
       │     │  └───────────────┘  │
       │     └──────────┬──────────┘
       │                │
       │                ▼
       │     ┌─────────────────────┐
       │     │  Processing Service │
       │     │  ┌───────────────┐  │
       │     │  │ Aggregation   │  │
       │     │  │ (Redis ZADD)  │  │
       │     │  ├───────────────┤  │
       │     │  │ Batch Writer  │  │
       │     │  │ (Raw SQL)     │  │
       │     │  ├───────────────┤  │
       │     │  │ Priority      │  │
       │     │  │ Router        │  │
       │     │  └───────────────┘  │
       │     └──────────┬──────────┘
       │                │
       ▼                ▼
┌──────────────────────────────────┐
│           Data Layer             │
│  ┌──────────┐ ┌──────────┐      │
│  │PostgreSQL│ │  Redis   │      │
│  │ (Prisma) │ │  Cache   │      │
│  │          │ │  (Counts)│      │
│  └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────────┐  │
│  │ DynamoDB │ │ Notification │  │
│  │  Local   │ │     API      │  │
│  │ (Logs)   │ │  (Port 3002) │  │
│  └──────────┘ └──────────────┘  │
└──────────────────────────────────┘
```

---

## 🧠 Why This Tech Stack? (Design Decisions)

### 1. Why Kafka? (Not RabbitMQ / SQS)

| Feature | Kafka | RabbitMQ |
|---|---|---|
| **Message Retention** | Keeps messages for 7 days on disk | Deletes after consumption |
| **Replay Capability** | ✅ Can reprocess if a service crashes | ❌ Cannot replay |
| **Throughput** | Millions/sec (partition-based) | Thousands/sec |
| **Consumer Groups** | ✅ Multiple consumers read same topic | Requires exchange routing |

**Our reasoning:** When a post goes viral, thousands of like events arrive per second. We need:
- **Priority-based routing** → We use 4 Kafka topics: `critical-notifications` (OTP, security), `high-priority-notifications` (follows from verified users), `low-priority-notifications` (likes from non-followers), and `ready-notifications` (final delivery to Socket.IO).
- **Replay capability** → If the `processing-service` crashes mid-aggregation, we can replay the Kafka log and re-aggregate without losing a single like.
- **Separate consumer groups** → `critical-consumer`, `high-priority-consumer`, `low-priority-consumer` process events at different speeds.

### 2. Why Redis? (The Write-Through Cache)

**The Core Problem**: If a post gets 10,000 likes in 1 second, writing each like to PostgreSQL immediately would:
- Require 10,000 `INSERT` queries per second
- Lock the `Like` table
- Kill response times for all other users

**Our Solution — Redis as a Write-Through Cache**:

```
User clicks Like
    │
    ▼
Redis INCR like:count:{postId}     ← Instant (< 1ms)
    │                                  User sees updated count IMMEDIATELY
    ▼
Kafka produces LIKE event          ← Async, non-blocking
    │
    ▼
Processing Service aggregates      ← Batches in Redis Sorted Set (ZADD)
    │
    ▼ (After 2 minutes OR threshold reached)
    │
Batch Writer: INSERT MANY to PostgreSQL  ← One transaction for 10,000 likes
    │
    ▼
Redis cache cleared (clearPostCache)     ← Next read falls through to DB
```

**How it works in code** (`redis-cache-service.ts`):
- `incrementLikeCount(postId)` → Runs `INCR` on `like:count:{postId}` with a 3-minute TTL
- `getLikeCount(postId)` → Reads from Redis first. On cache miss → falls back to PostgreSQL and warms the cache
- `clearPostCache(postId)` → Called after the batch write to invalidate stale cache

**Result**: The frontend always shows the correct like count (from Redis) but PostgreSQL only receives ONE batch write instead of 10,000 individual writes.

### 3. Why PostgreSQL? (Not MongoDB / NoSQL)

| Requirement | PostgreSQL | MongoDB |
|---|---|---|
| **Foreign Keys** (User→Post→Like→Comment) | ✅ Native | ❌ Manual |
| **Cascade Deletes** (Delete user → delete all their posts) | ✅ `ON DELETE CASCADE` | ❌ Application code |
| **ACID Transactions** (Batch write 1000 likes atomically) | ✅ Full support | ⚠️ Limited |
| **Complex Joins** (Get posts with like counts and comment counts) | ✅ Single query | ❌ Multiple queries |

**Our reasoning:** Social data is inherently **relational**. A Like belongs to a User AND a Post. A Comment belongs to a User AND a Post. A Follow connects TWO Users. NoSQL would require denormalization and manual reference management, which introduces bugs when data changes. PostgreSQL with Prisma ORM gives us type-safe relations and cascade behaviors out of the box.

### 4. Why DynamoDB Local? (Notification Logging)

Every notification attempt (sent/failed/filtered) is logged for auditing. This is:
- **Append-only** — We never update or delete logs
- **High volume** — Every like, comment, follow generates a log entry
- **Schema-flexible** — Different notification types have different metadata

DynamoDB's key-value model is perfect for this: write-once, read-rarely, massive volume. Using it locally for development avoids AWS costs while matching production patterns.

---

## ⚙️ Two Modes: Production vs. Testing

### Production Mode (Default Behavior)

The system uses **smart aggregation** to protect the database:

| Scenario | Behavior | Why |
|---|---|---|
| **1–3 likes** on a post | **Instant notification** → "John liked your post" | Low volume, safe for DB |
| **4+ likes** on a post | **Batched notification** → "John and 4 others liked your post" (after ~2 min) | High volume, protect DB |
| **Any comments** | **Always batched** → "3 people commented on your post" (after ~60-120s) | Comments always aggregated |
| **Follows** | **Instant notification** | One-time event, safe for DB |
| **OTP / Security alerts** | **Critical priority** → Instant, bypasses aggregation entirely | Must never be delayed |

The aggregation window is **2 minutes** (`AGGREGATION_WINDOW_SECONDS = 120` in `aggregationService.ts`). The instant-like threshold is **3** (`INSTANT_LIKE_THRESHOLD = 3`).

### Testing Mode (Built-In Frontend Testing Controls)

The frontend includes **two built-in testing interfaces** that let you observe the batching behavior in real-time:

#### 🎛️ Post Tester (Simulation Dials)

Located **below each post** in the feed, the `PostTester` component provides:

- **Like Slider (1–15)** → Drag to set how many simulated users will like the post
  - **Green indicator**: 1–3 likes → Shows "Instant: Immediate delivery"
  - **Yellow indicator**: 4+ likes → Shows "Batched: ~60s wait"
- **Comment Slider (1–10)** → Drag to set how many simulated comments
  - Always shows "Batched: Comments wait for 60s aggregation window"
- **Simulation Type** → Choose between Mixed / Followers Only / Non-Followers Only
  - This controls whether test users follow the post owner before liking (affects notification priority)
- **Cleanup Button** → Deletes all test users and their data

**These are real backend requests** — they create actual test users in PostgreSQL, generate real Kafka events, and flow through the entire notification pipeline. They are NOT frontend mocks.

#### 📊 Database Monitor (Database Viewer Page)

A dedicated page (`/database`) that shows the **raw PostgreSQL tables** in real-time:

- **4 Tabs**: Notification History, Likes, Comments, Follows
- **Auto-refresh every 3 seconds** (configurable toggle)
- **Stats cards** showing total counts and recent additions (last 5 minutes)
- **Clear All Data** button for resetting test data

**How to test the batching behavior:**
1. Create a post
2. Open the Post Tester below it
3. Set likes to **2** → Send → Notice the Database Viewer shows the Like record **immediately**
4. Set likes to **8** → Send → Notice the likes appear in the frontend count **instantly** (Redis), but the Database Viewer **does not show new Like records for ~2 minutes** (batched write)
5. Wait ~2 minutes → Refresh Database Viewer → The 8 likes now appear in PostgreSQL

#### 🖥️ System Dashboard

A pipeline visualization showing:
- **Service Health** — Real-time health checks for all services (green/red/yellow status)
- **Pipeline Animation** — Visual flow showing events moving through Trigger → Ingestion → Processing → Delivery
- **Stats** — Total notifications, users, fallback queue pending/failed
- **Demo Buttons** — Simulate Like/Comment/Follow/OTP events through the animated pipeline

---

## 🛡️ Fallback Strategies & Reliability

### Kafka Fallback (✅ IMPLEMENTED)

**If Kafka goes down**, the system does NOT lose events. The `ingestion-service` has a **fully implemented PostgreSQL-backed fallback queue**:

**How it works** (`fallbackService.ts` + `producerService.ts`):

1. `producerService.sendEvent()` first attempts to send via Kafka
2. If Kafka fails → automatically calls `storeInFallback()` which writes the event to the `KafkaFallbackQueue` table in PostgreSQL
3. The `KafkaFallbackQueue` stores: event payload, retry count (max 5 retries), topic, processed flag, timestamps
4. When Kafka recovers → unprocessed events can be retrieved via `getUnprocessedEvents()` and replayed
5. The System Dashboard shows `Pending Fallback` and `Failed Fallback` counts in real-time

**Additionally**: Both `ingestion-service` and `socket-service` have **retry logic with exponential backoff** for Kafka connections and topic subscriptions, so they don't crash on startup if Kafka isn't ready yet.

### Redis Fallback (✅ IMPLEMENTED)

**If Redis goes down** for read operations:

- `getLikeCount()` / `getCommentCount()` / `getFollowCount()` all **fall back to querying PostgreSQL directly** on cache miss
- The aggregation service has a fallback: if Redis aggregation fails during processing, the notification is **sent immediately** instead of being queued (`catch → return { shouldSendNow: true }` in `aggregationService.ts`)

**If Redis goes down** for write operations:
- Cache increments (`INCR`) will fail, but the Kafka event is still produced independently
- The batch write still happens via Kafka → Processing Service → PostgreSQL, just without the instant cache benefit

### Thundering Herd Problem

**Partially addressed:**

| Aspect | Status | Details |
|---|---|---|
| **Redis SCAN vs KEYS** | ✅ Present | Uses `SCAN` during flush cycles to avoid blocking the Redis single-thread |
| **Priority-based consumer groups** | ✅ Present | Critical, High, and Low priority consumers prevent all events from hitting one queue |
| **Batched writes** | ✅ Present | The 2-minute aggregation window inherently spreads DB load over time |
| **Jitter / Staggered timers** | ❌ Not present | All aggregation windows close at fixed intervals (every 2 min). In hyperscale, this creates periodic CPU spikes. Adding random jitter (e.g., ±30 seconds) would smooth this out |
| **Circuit breaker pattern** | ❌ Not present | No automatic circuit breaking if downstream services are overloaded |

---

## ❓ FAQ (Honest Answers Based on the Actual Codebase)

### Q1: How does the like count show instantly if it's not written to the database?

**Answer:** When you like a post, TWO things happen simultaneously:
1. **Redis `INCR like:count:{postId}`** — The like count key in Redis is incremented (<1ms). The frontend reads counts from Redis via the API, so the user sees the updated count **immediately**.
2. **Kafka event produced** — The LIKE event is sent to Kafka for async processing.

The actual `Like` row in PostgreSQL is written later during the batch flush (every 2 minutes). So the user sees "5 likes" instantly, but if you check the DB table directly, it might still show "0 likes" until the batch runs.

### Q2: What happens if the server crashes between Redis increment and the batch write?

**Answer:** If the `processing-service` crashes:
- Redis has a 3-minute TTL on cache keys (`CACHE_TTL = 180`). The cached count will eventually expire.
- Kafka retains the unprocessed LIKE events for 7 days. When the processing-service restarts, it picks up where it left off (Kafka consumer group offset tracking).
- **Worst case**: The like count in Redis might temporarily show a higher number than PostgreSQL. After the cache TTL expires, the next read falls through to PostgreSQL and the cache is warmed with the correct DB value.

### Q3: Why not use a simple queue like Bull/BullMQ instead of Kafka?

**Answer:** Bull uses Redis as its backend, which means:
- No message retention — If Redis crashes, queued jobs are lost
- Single-node throughput — No partition-based parallelism
- No replay — Cannot reprocess past events

Kafka gives us: durable log storage, partition-based scaling, consumer groups, and 7-day message retention — all critical for a notification system that cannot afford to lose events.

### Q4: How does the follower-based priority work?

**Answer:** In `aggregationService.ts`, when processing a LIKE event:
- If the liker **follows** the post owner → Higher priority batching (shown with priority in the notification)
- If the liker **does not follow** the post owner → Lower priority (waits for full aggregation window)

The frontend testing dials let you simulate this: choose "Followers" to create test users that follow the post owner first, or "Non-Followers" to skip the follow step.

### Q5: Why are comments always batched and never instant?

**Answer:** Unlike likes (which are a simple boolean toggle), comments contain **text content** that can trigger discussions. If 10 people comment in rapid succession, sending 10 separate notifications ("Person A commented", "Person B commented"...) would be spammy. Instead, the system waits for the aggregation window and sends ONE notification: "Person A and 9 others commented on your post".

### Q6: How does the KafkaFallbackQueue work in detail?

**Answer:** The `KafkaFallbackQueue` table in PostgreSQL has these fields:
- `eventId` — The original notification event ID
- `topic` — Which Kafka topic it was meant for
- `payload` — The full serialized event data (JSON)
- `processed` — Boolean flag (false = needs retry)
- `retryCount` — Number of failed attempts (max 5 before marked as permanently failed)
- `createdAt` / `processedAt` — Timestamps for auditing

When Kafka is unavailable, `producerService.ts` catches the error and calls `storeInFallback()`. The system dashboard's "Pending Fallback" counter shows how many events are waiting to be replayed.

### Q7: Could this handle Instagram-scale traffic?

**Answer:** The architecture patterns are correct (this is how Instagram actually works), but a true production deployment would need:
- **Kafka cluster** (3+ brokers with replication, not the single-broker docker setup)
- **Redis Cluster** (sharded across multiple nodes)
- **PostgreSQL read replicas** (separate read and write traffic)
- **Kubernetes** for horizontal scaling of microservices
- **Jitter on aggregation timers** (not yet implemented)
- **Circuit breakers** (not yet implemented)

The single-Docker-Compose setup is designed for **demonstrating the architecture**, not handling actual Instagram traffic.

### Q8: Why separate ingestion-service and processing-service?

**Answer:** **Decoupling producers from consumers.** The ingestion-service only does one thing: receive HTTP events and put them on Kafka (or the fallback queue). It doesn't care about aggregation logic, priority routing, or database writes. This means:
- If the processing-service crashes → events are safely stored in Kafka
- If the ingestion-service is overloaded → processing continues from the Kafka backlog
- They can be scaled independently (e.g., 3 ingestion replicas, 1 processing replica)

### Q9: What databases does this project use and why?

**Answer:**
| Database | Purpose | Why Not Something Else |
|---|---|---|
| **PostgreSQL** | Users, Posts, Likes, Comments, Follows, Notifications | Relational data needs foreign keys and ACID transactions |
| **Redis** | Like/Comment/Follow counts (cache), aggregation windows (sorted sets) | Sub-millisecond reads for instant UI updates |
| **DynamoDB Local** | Notification delivery logs (sent/failed/filtered) | High-volume append-only logs, schema-flexible |
| **Kafka** | Event queue (not a database, but stores events for 7 days) | Durable event log with replay capability |

### Q10: How is the batch write actually performed?

**Answer:** The `batchWriteService.ts` in `processing-service` uses **raw SQL** (not Prisma's ORM methods) for performance:
- `batchWriteLikes(events)` → Collects all like events in the window → runs a single `INSERT MANY` transaction
- `batchWriteComments(events)` → Same pattern for comments
- `batchWriteFollows(events)` → Same pattern for follows
- After each batch write → calls `clearPostCache(postId)` to invalidate the Redis cache

This means 1,000 likes become 1 database transaction instead of 1,000 individual `INSERT` statements.

### Q11: Is there any rate limiting?

**Answer:** There is no explicit rate limiting implemented in the API layer. However, the batching architecture inherently acts as a form of rate limiting for database writes — no matter how many events arrive, the DB only receives batch writes every 2 minutes.

### Q12: How does the System Dashboard get its real-time data?

**Answer:** The `SystemDashboard.tsx` component:
- Polls health endpoints (`/health`) on each service every 5 seconds to show online/offline status
- Fetches admin stats from the `notification-api` every 10 seconds (total notifications, users, fallback queue status)
- Has demo buttons that trigger **simulated** pipeline animations (these are visual only, not actual events)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- npm or yarn

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts: PostgreSQL, Kafka (KRaft mode), Redis, DynamoDB Local.

### 2. Setup Database

```bash
cd backend/shared
npx prisma migrate dev
npx prisma generate
```

### 3. Start All Services

```bash
npm run start:all
```

This concurrently starts all backend services using the `start-all.js` script.

### 4. Start Frontend

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173`.

---

## 📂 Project Structure

```
notification-system/
│
├── 📁 frontend/                                    # React + Vite Frontend (Port 5173)
│   └── src/
│       ├── App.tsx                                  # Main app — routing, layout, auth guards
│       ├── main.tsx                                 # Vite entry point
│       ├── index.css                                # Global styles
│       │
│       ├── components/
│       │   ├── Feed.tsx                             # Post feed — displays all posts with like/comment counts
│       │   ├── PostCreation.tsx                     # Create new post form
│       │   ├── PostTester.tsx                       # 🎛️ Simulation dials (like/comment sliders per post)
│       │   ├── Login.tsx                            # Login form with JWT auth
│       │   ├── Register.tsx                         # User registration form
│       │   ├── Navbar.tsx                           # Top navigation bar
│       │   ├── UserProfile.tsx                      # User profile page with follow/unfollow
│       │   ├── NotificationBell.tsx                 # 🔔 Real-time notification dropdown (WebSocket)
│       │   ├── NotificationItem.tsx                 # Individual notification card renderer
│       │   ├── NotificationPreferences.tsx          # Per-user notification settings
│       │   ├── NotificationTester.tsx               # Manual notification testing panel
│       │   ├── BellToggle.tsx                       # YouTube-style bell subscription toggle
│       │   ├── ConnectionStatus.tsx                 # WebSocket connection indicator
│       │   ├── SystemDashboard.tsx                  # 🖥️ Pipeline visualization + service health
│       │   ├── ToastNotification.tsx                # Pop-up notification toasts
│       │   └── ErrorBoundary.tsx                    # React error boundary wrapper
│       │
│       ├── pages/
│       │   └── DatabaseViewer.tsx                   # 📊 Raw PostgreSQL table viewer (auto-refresh 3s)
│       │
│       ├── context/
│       │   ├── AuthContext.tsx                      # JWT auth state (login, logout, token refresh)
│       │   ├── SocketProvider.tsx                   # Socket.IO connection + event listeners
│       │   ├── socketContextState.ts                # Socket context type definitions
│       │   └── AppModeContext.tsx                   # Production vs Testing mode toggle
│       │
│       ├── hooks/
│       │   ├── useAuth.ts                           # Auth context hook
│       │   └── useSocket.ts                         # Socket context hook
│       │
│       ├── config/
│       │   └── api.ts                               # API base URLs for all backend services
│       │
│       └── types/
│           └── index.ts                             # Shared TypeScript interfaces (Post, User, Notification)
│
├── 📁 backend/
│   │
│   ├── 📁 social-api/                              # Port 3003 — Core Social Platform API
│   │   └── src/
│   │       ├── server.ts                            # Express server setup + route mounting
│   │       ├── config/
│   │       │   └── env.ts                           # Environment variable loader
│   │       ├── middleware/
│   │       │   └── auth.ts                          # JWT authentication middleware
│   │       ├── routes/
│   │       │   ├── authRoutes.ts                    # POST /register, /login, /refresh-token
│   │       │   ├── postRoutes.ts                    # CRUD /posts — creates posts, gets feed
│   │       │   ├── commentRoutes.ts                 # POST/GET /comments — nested replies
│   │       │   ├── followRoutes.ts                  # POST /follow, /unfollow, /bell-subscribe
│   │       │   ├── userRoutes.ts                    # GET /users/search, /users/:id
│   │       │   ├── bookmarkRoutes.ts                # POST/DELETE /bookmarks
│   │       │   ├── preferencesRoutes.ts             # GET/PUT notification preferences
│   │       │   └── testRoutes.ts                    # 🧪 /simulate-likes, /simulate-comments, /cleanup
│   │       └── utils/
│   │           └── kafka.ts                         # Kafka producer for publishing social events
│   │
│   ├── 📁 ingestion-service/                       # Port 3000 — Event Ingestion + Kafka Producer
│   │   └── src/
│   │       ├── app.ts                               # Express server + Kafka producer init
│   │       ├── config/
│   │       │   └── kafka.ts                         # KafkaJS client config + retry connection
│   │       ├── controller/
│   │       │   └── eventController.ts               # POST /events — receives notification events
│   │       ├── routes/
│   │       │   └── eventRoutes.ts                   # Route definitions for /events
│   │       └── services/
│   │           ├── producerService.ts               # 🔄 Kafka send + automatic PostgreSQL fallback
│   │           └── fallbackService.ts               # 📦 KafkaFallbackQueue CRUD (store, retrieve, retry)
│   │
│   ├── 📁 processing-service/                      # Kafka Consumer — Aggregation Engine
│   │   └── src/
│   │       ├── index.ts                             # Main entry — 3 consumer groups (Critical/High/Low)
│   │       ├── config/
│   │       │   ├── kafka.ts                         # KafkaJS client config
│   │       │   ├── redis.ts                         # Redis (ioredis) client config
│   │       │   └── initTopics.ts                    # Creates 4 Kafka topics on startup
│   │       ├── services/
│   │       │   ├── aggregationService.ts            # 🧠 Core: Redis ZADD aggregation + instant vs batched logic
│   │       │   ├── batchWriteService.ts             # 💾 Raw SQL batch INSERT for likes/comments/follows
│   │       │   ├── dynamoService.ts                 # DynamoDB notification log writer
│   │       │   └── preferenceService.ts             # User preference checker (do-not-disturb, channels)
│   │       └── scripts/
│   │           └── initDynamoDB.ts                  # Creates DynamoDB tables on first run
│   │
│   ├── 📁 notification-api/                        # Port 3002 — Notification History + Admin
│   │   └── src/
│   │       ├── app.ts                               # Express server + all admin/notification routes
│   │       ├── middleware/
│   │       │   └── auth.ts                          # JWT auth middleware
│   │       └── routes/
│   │           └── adminRoutes.ts                   # GET /admin/stats, /admin/db/:table, DELETE /admin/db/clear
│   │
│   ├── 📁 socket-service/                          # Port 4000 — WebSocket Delivery
│   │   └── src/
│   │       ├── server.ts                            # HTTP + Socket.IO server, JWT room auth
│   │       ├── config/
│   │       │   └── env.ts                           # Environment variable loader
│   │       └── services/
│   │           └── kafkaConsumer.ts                  # Consumes 'ready-notifications' → emits to Socket.IO rooms
│   │
│   └── 📁 shared/                                  # Shared code across all backend services
│       ├── types.ts                                 # NotificationEvent, Priority, Channel types
│       ├── retryHandler.ts                          # Generic retry with exponential backoff
│       ├── prisma/
│       │   ├── schema.prisma                        # 📐 Full DB schema (User, Post, Like, Comment, Follow, etc.)
│       │   ├── migrations/                          # PostgreSQL migration history
│       │   └── generated/                           # Prisma Client (auto-generated)
│       ├── services/
│       │   └── redis-cache-service.ts               # ⚡ Write-through cache (INCR, GET with DB fallback, TTL)
│       ├── middleware/
│       │   └── tracing.ts                           # Request tracing middleware
│       └── utils/
│           └── logger.ts                            # Centralized logger utility
│
├── 📁 scripts/                                     # Development & testing utilities
│   ├── start-all.js                                 # 🚀 Concurrent launcher for all backend services
│   ├── setup-prisma.js                              # Prisma migration + generate helper
│   ├── diagnose-pipeline.js                         # End-to-end pipeline health checker
│   ├── test-aggregation.js                          # Automated aggregation behavior tests
│   ├── test-high-priority-consumer.js               # High-priority consumer test
│   ├── check-offsets.js                             # Kafka consumer offset inspector
│   └── TESTING.md                                   # Testing guide documentation
│
├── 📁 infra/                                       # Infrastructure configuration
│   ├── DOCKER_SETUP.md                              # Docker setup documentation
│   └── postgres-init.sql                            # Initial PostgreSQL schema seed
│
├── docker-compose.yml                               # 🐳 Kafka (KRaft), PostgreSQL, Redis, DynamoDB Local
├── package.json                                     # Root package — workspace scripts
└── .env                                             # Environment variables (DB URLs, JWT secrets, ports)
```

---

## 📜 License

MIT
