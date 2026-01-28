# 🔔 Intelligent Notification System

A scalable, real-time notification delivery platform with Instagram-like social features, built with microservices architecture.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Kafka](https://img.shields.io/badge/Apache%20Kafka-231F20?style=flat&logo=apache-kafka&logoColor=white)](https://kafka.apache.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)

## 🎯 Overview

An enterprise-grade notification system that combines real-time delivery, intelligent aggregation, and social platform features. Built with microservices architecture for scalability and maintainability.

### What Makes This Production-Ready

**Write-Through Caching with Batched Persistence**
- Redis cache provides instant like/comment counts to frontend (<10ms reads)
- PostgreSQL writes batched every 2 minutes to reduce DB load by 95%
- Cache invalidation after batch write ensures data consistency
- *Solves*: High-frequency write bottlenecks while maintaining real-time UX

**Event-Driven Architecture with Smart Aggregation**
- Kafka-based async processing decouples services for horizontal scaling
- Intelligent batching: 1-2 events instant, 3+ aggregated in 2-minute windows
- Priority-based routing (CRITICAL/HIGH/LOW) with separate consumer groups
- *Solves*: Notification fatigue and system overload during viral events

**Multi-Channel Delivery with Fallback**
- WebSocket for instant push, Email/SMS for offline users
- Dead letter queue for failed deliveries with exponential backoff
- User preference engine with DND mode and channel selection
- *Solves*: Guaranteed delivery across heterogeneous client environments

**Real-Time Database Monitoring**
- Live admin dashboard showing batching behavior and system health
- Separate read/write paths for analytics without impacting transactional load
- *Solves*: Observability into async batch operations

## ✨ Key Features

### Notification System
- **Real-time Delivery**: WebSocket push (<100ms latency)
- **Smart Aggregation**: Time-windowed batching (2min) with instant feedback for low-volume events
- **Multi-Channel**: Push, Email (SendGrid), SMS (Twilio)
- **Priority Routing**: CRITICAL (instant), HIGH (social), LOW (marketing)
- **User Preferences**: DND mode, channel selection, read/unread tracking

### Social Platform
- **Core Features**: Posts, Comments, Likes, Follows with real-time notifications
- **Bell Subscriptions**: YouTube-style notifications for specific users
- **Engagement**: Instant UI updates via Redis cache, batched DB persistence
- **Profile Management**: User search, avatars, follower/following counts

### Performance Optimizations
- **Batched Writes**: 95% reduction in DB write operations
- **Redis Cache**: <10ms read latency for social action counts
- **Kafka Partitioning**: Parallel processing across consumer groups
- **Connection Pooling**: Prisma connection management for PostgreSQL

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│  Login/Register • Feed • Posts • Profile • Notifications        │
└────────────┬──────────────┬──────────────┬─────────────────────┘
             │              │              │
    ┌────────▼───────┐ ┌───▼──────────┐ ┌─▼──────────────┐
    │  Social API    │ │ Notification │ │ Ingestion API  │
    │   (3003)       │ │  API (3002)  │ │    (3001)      │
    └────────┬───────┘ └───┬──────────┘ └─┬──────────────┘
             │             │               │
             │             │               │
             └─────────────┴───────────────┘
                           │
                      ┌────▼─────┐
                      │  Kafka   │
                      │ raw-events│
                      │   ready   │
                      └────┬─────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼─────┐   ┌─────▼──────┐   ┌────▼─────┐
     │Processing│   │   Socket   │   │  Email   │
     │ Service  │   │  Service   │   │ Service  │
     │          │   │   (3004)   │   │          │
     └────┬─────┘   └─────┬──────┘   └────┬─────┘
          │               │               │
          │          WebSocket        SendGrid
          │               │               │
     ┌────▼─────┐   ┌────▼─────┐   ┌────▼─────┐
     │PostgreSQL│   │  Redis   │   │   SMS    │
     │          │   │  Cache   │   │ Service  │
     │ Prisma   │   └──────────┘   └────┬─────┘
     └──────────┘                       │
                                     Twilio
```

### Data Flow

1. **Event Generation**: User action (like, comment, follow) → Social API
2. **Event Publishing**: Social API → Kafka (raw-events topic)
3. **Processing**: Processing Service consumes events
   - Checks user preferences
   - Aggregates similar notifications
   - Routes by priority
4. **Delivery**: Multiple channels
   - **Push**: Socket Service → WebSocket → Frontend
   - **Email**: Email Service → SendGrid API
   - **SMS**: SMS Service → Twilio API
5. **Storage**: PostgreSQL stores notification history
6. **Retrieval**: Notification API serves history to frontend

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework with hooks |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Tailwind CSS** | Utility-first styling |
| **Socket.io Client** | WebSocket connection |
| **Axios** | HTTP client |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **TypeScript** | Type safety |
| **Express** | REST API framework |
| **Prisma ORM** | Database toolkit |
| **Apache Kafka** | Message broker |
| **Socket.io** | WebSocket server |
| **JWT** | Authentication tokens |
| **bcrypt** | Password hashing |

### Databases & Caching
| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary database (batched writes every 2min) |
| **Redis** | Write-through cache for instant counts + aggregation windows |
| **DynamoDB** | Notification logs (optional) |

### External Services
| Service | Purpose |
|---------|---------|
| **SendGrid** | Email delivery |
| **Twilio** | SMS delivery |

### DevOps
| Tool | Purpose |
|------|---------|
| **Docker** | Containerization (Kafka KRaft mode) |
| **Nodemon** | Auto-reload in dev |
| **ts-node** | TypeScript execution |

## 📁 Project Structure

```
notification-system/
├── backend/
│   ├── ingestion-service/          # Event ingestion API
│   │   ├── src/
│   │   │   ├── app.ts              # Express server
│   │   │   ├── config/kafka.ts     # Kafka producer
│   │   │   └── controller/         # Event controllers
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── processing-service/         # Core notification processor
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Database schema (shared)
│   │   ├── src/
│   │   │   ├── index.ts            # Kafka consumer
│   │   │   ├── config/
│   │   │   │   ├── kafka.ts
│   │   │   │   └── redis.ts
│   │   │   └── services/
│   │   │       ├── aggregationService.ts  # Smart batching
│   │   │       ├── preferenceService.ts   # User preferences
│   │   │       └── dynamoService.ts       # Log storage
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── socket-service/             # Real-time push delivery
│   │   ├── src/
│   │   │   ├── server.ts           # Socket.io server
│   │   │   └── services/
│   │   │       └── kafkaConsumer.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── email-service/              # Email delivery
│   │   ├── src/
│   │   │   ├── index.ts            # Kafka consumer
│   │   │   └── services/
│   │   │       └── emailService.ts # SendGrid integration
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sms-service/                # SMS delivery
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── services/
│   │   │       └── smsService.ts   # Twilio integration
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── notification-api/           # Notification history API
│   │   ├── src/
│   │   │   └── app.ts              # REST endpoints
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── social-api/                 # Social platform API
│   │   ├── src/
│   │   │   ├── server.ts           # Express server
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts         # JWT middleware
│   │   │   ├── routes/
│   │   │   │   ├── authRoutes.ts   # Login/Register
│   │   │   │   ├── userRoutes.ts   # User management
│   │   │   │   ├── postRoutes.ts   # Post CRUD (Redis cache reads)
│   │   │   │   ├── commentRoutes.ts # Comments
│   │   │   │   ├── followRoutes.ts  # Follow system
│   │   │   │   └── testRoutes.ts    # Bulk simulation (Redis cache writes)
│   │   │   └── utils/
│   │   │       └── kafka.ts        # Event producer
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/
│       ├── types.ts                # Shared TypeScript types
│       ├── prisma/                 # Shared Prisma schema
│       └── services/
│           └── redis-cache-service.ts  # Write-through cache for instant counts
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Main app component
│   │   ├── main.tsx                # Entry point
│   │   ├── components/
│   │   │   ├── Login.tsx           # Login form
│   │   │   ├── Register.tsx        # Registration form
│   │   │   ├── Navbar.tsx          # Navigation bar
│   │   │   ├── Feed.tsx            # Post feed with real-time updates
│   │   │   ├── UserProfile.tsx     # User profile with bell toggle
│   │   │   ├── PostCreation.tsx    # Create post modal
│   │   │   ├── PostTester.tsx      # Inline notification tester
│   │   │   ├── BellToggle.tsx      # Bell subscription component
│   │   │   ├── NotificationBell.tsx # Notification dropdown
│   │   │   ├── NotificationItem.tsx # Notification card
│   │   │   ├── NotificationTester.tsx # Testing interface
│   │   │   ├── NotificationPreferences.tsx # Settings
│   │   │   └── DatabaseViewer.tsx  # Real-time DB monitoring (batching proof)
│   │   ├── context/
│   │   │   ├── AuthContext.tsx     # Auth state
│   │   │   └── SocketProvider.tsx  # WebSocket connection
│   │   ├── hooks/
│   │   │   ├── useAuth.ts          # Auth hook
│   │   │   └── useSocket.ts        # Socket hook
│   │   ├── config/
│   │   │   └── api.ts              # API endpoints
│   │   └── types/
│   │       └── index.ts            # TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── infra/                          # Infrastructure configs
├── docker-compose.yml              # Kafka (KRaft mode), PostgreSQL, Redis, DynamoDB
├── BACKEND_CONNECTIONS.md          # Service connections
└── README.md                       # This file
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Redis** 6+
- **Docker** & Docker Compose (for Kafka)
- **SendGrid API Key** (optional for email)
- **Twilio Account** (optional for SMS)

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/Biku2004/Intelligent-Notification-Service.git
cd notification-system
```

#### 2. Start Infrastructure (Kafka KRaft, PostgreSQL, Redis, DynamoDB)

```bash
docker-compose up -d
```

#### 3. Setup Database

```bash
cd backend/processing-service

# Create PostgreSQL database
createdb notification_system

# Set environment variables
echo "DATABASE_URL=postgresql://username:password@localhost:5432/notification_system" > .env

# Run migrations
npx prisma migrate dev --name init
npx prisma generate
```

#### 4. Install Dependencies

```bash
# Backend services
cd backend/ingestion-service && npm install
cd ../processing-service && npm install
cd ../socket-service && npm install
cd ../email-service && npm install
cd ../sms-service && npm install
cd ../notification-api && npm install
cd ../social-api && npm install

# Frontend
cd ../../frontend && npm install
```

#### 5. Configure Environment Variables

Create `.env` files in each service directory:

**backend/social-api/.env**:
```env
PORT=3003
DATABASE_URL=postgresql://username:password@localhost:5432/notification_system
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
KAFKA_BROKERS=localhost:9092
```

**backend/notification-api/.env**:
```env
PORT=3002
DATABASE_URL=postgresql://username:password@localhost:5432/notification_system
```

**backend/processing-service/.env**:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/notification_system
REDIS_HOST=localhost
REDIS_PORT=6379
KAFKA_BROKERS=localhost:9092
```

**backend/email-service/.env**:
```env
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
KAFKA_BROKERS=localhost:9092
```

**backend/sms-service/.env**:
```env
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
KAFKA_BROKERS=localhost:9092
```

#### 6. Start Services

Open 7 terminal windows:

```bash
# Terminal 1 - Processing Service
cd backend/processing-service
npm run dev

# Terminal 2 - Ingestion API
cd backend/ingestion-service
npm run dev

# Terminal 3 - Socket Service
cd backend/socket-service
npm run dev

# Terminal 4 - Notification API
cd backend/notification-api
npm run dev

# Terminal 5 - Social API
cd backend/social-api
npm run dev

# Terminal 6 - Email Service (optional)
cd backend/email-service
npm run dev

# Terminal 7 - Frontend
cd frontend
npm run dev
```

#### 7. Access Application

- **Frontend**: http://localhost:5173
- **Social API**: http://localhost:3003
- **Notification API**: http://localhost:3002
- **Ingestion API**: http://localhost:3001
- **Socket Service**: ws://localhost:3004

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/auth/register
Register a new user.

```bash
curl -X POST http://localhost:3003/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "john_doe",
    "password": "password123",
    "name": "John Doe"
  }'
```

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "john_doe",
    "name": "John Doe"
  },
  "token": "jwt-token"
}
```

#### POST /api/auth/login
Login existing user.

```bash
curl -X POST http://localhost:3003/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Social Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users/:userId` | Get user profile | Optional |
| PATCH | `/api/users/:userId` | Update profile | Required |
| GET | `/api/users?q=search` | Search users | No |
| POST | `/api/posts` | Create post | Required |
| GET | `/api/posts` | Get feed | Optional |
| POST | `/api/posts/:postId/like` | Like/unlike | Required |
| POST | `/api/comments` | Add comment | Required |
| GET | `/api/comments?postId=id` | Get comments | No |
| POST | `/api/follows/:userId` | Follow/unfollow | Required |
| GET | `/api/follows/:userId/followers` | Get followers | No |
| POST | `/api/follows/:userId/bell` | Toggle bell | Required |

### Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/:userId` | Get notification history |
| PATCH | `/api/notifications/:notificationId/read` | Mark as read |
| PATCH | `/api/notifications/:userId/read-all` | Mark all as read |
| GET | `/api/preferences/:userId` | Get preferences |
| PATCH | `/api/preferences/:userId` | Update preferences |



## 📝 License

This project is licensed under the ISC License.

## 👥 Authors

- **Biku2004** - [GitHub](https://github.com/Biku2004)

## 🙏 Acknowledgments

- React & Node.js communities
- Apache Kafka documentation
- Prisma ORM team
- Socket.io contributors

---

**⭐ Star this repo if you find it helpful!**

