# Docker Infrastructure Setup

## 🚀 Production-Ready Configuration

This Docker Compose setup is production-ready and requires **NO manual UI configuration**. All services are automatically configured on startup.

## 📦 Services

### 1. PostgreSQL (Port 5432)
- **Image**: `postgres:15-alpine`
- **Auto-configured**: Yes ✅
- **Database**: `notification_system`
- **User**: `admin`
- **Password**: `password123`
- **Features**:
  - Health checks enabled
  - Auto-restart on failure
  - Persistent data storage
  - UTF-8 encoding
  - Initialization script runs on first start

### 2. Redis (Port 6379)
- **Image**: `redis:7-alpine` (production Redis, not redis-stack)
- **Auto-configured**: Yes ✅
- **Features**:
  - AOF persistence enabled (appendonly yes)
  - Memory limit: 256MB
  - Eviction policy: allkeys-lru
  - Auto-save: Every 60s if 1000+ keys changed
  - Health checks enabled
  - Auto-restart on failure

### 3. DynamoDB Local (Port 8000)
- **Image**: `amazon/dynamodb-local`
- **Auto-configured**: Yes ✅
- **Features**:
  - Persistent storage
  - Health checks enabled
  - AWS Region: us-east-1

### 4. Kafka (Port 9092)
- **Image**: `confluentinc/cp-kafka:7.4.0`
- **Auto-configured**: Yes ✅
- **Mode**: KRaft (No Zookeeper needed)
- **Features**:
  - Auto-create topics enabled
  - Log retention: 7 days
  - JMX metrics exposed on port 9101
  - Health checks enabled
  - Persistent logs

## 🎯 Quick Start

### Start All Services (Production Mode)

```bash
docker-compose up -d
```

### Check Service Health

```bash
# Check all services
docker-compose ps

# Check logs
docker-compose logs -f

# Check specific service
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f kafka
```

### Verify Services

```bash
# PostgreSQL
docker exec -it notif_postgres psql -U admin -d notification_system -c "\l"

# Redis
docker exec -it notif_redis redis-cli ping

# Kafka (list topics)
docker exec -it notif_kafka kafka-topics --bootstrap-server localhost:9092 --list

# DynamoDB
curl http://localhost:8000
```

### Stop All Services

```bash
docker-compose down
```

### Stop and Remove Data

```bash
docker-compose down -v
```

## 🛠️ Development Mode (With UIs)

If you want to enable management UIs for local development, uncomment the following services in `docker-compose.yml`:

1. **pgAdmin** (Port 5050) - PostgreSQL UI
   - URL: http://localhost:5050
   - Email: admin@admin.com
   - Password: admin

2. **Redis Commander** (Port 8081) - Redis UI
   - URL: http://localhost:8081

3. **Kafka UI** (Port 8080) - Kafka Management
   - URL: http://localhost:8080

4. **DynamoDB Admin** (Port 8002) - DynamoDB UI
   - URL: http://localhost:8002

To enable UIs:
```bash
# Edit docker-compose.yml and uncomment the UI services
# Then restart
docker-compose down
docker-compose up -d
```

## 📊 Service URLs

| Service | Port | Connection String | Health Check |
|---------|------|-------------------|--------------|
| PostgreSQL | 5432 | `postgresql://admin:password123@localhost:5432/notification_system` | ✅ pg_isready |
| Redis | 6379 | `redis://localhost:6379` | ✅ redis-cli ping |
| Kafka | 9092 | `localhost:9092` | ✅ nc -z |
| DynamoDB | 8000 | `http://localhost:8000` | ✅ curl |

## 🔧 Configuration

### PostgreSQL Configuration

The database is automatically configured via:
- Environment variables in docker-compose.yml
- Initialization script: `infra/postgres-init.sql`

**Default Settings**:
- Database: `notification_system`
- User: `admin`
- Password: `password123`
- Encoding: UTF-8
- Timezone: UTC

**Update .env files** across services:
```env
DATABASE_URL=postgresql://admin:password123@localhost:5432/notification_system
```

### Redis Configuration

**Persistence Settings**:
- AOF enabled (Append Only File)
- Fsync: every second
- Snapshot: every 60s if 1000+ writes

**Memory Management**:
- Max Memory: 256MB
- Eviction: LRU (Least Recently Used)

**Connection**:
```typescript
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // No password needed for local development
});
```

### Kafka Configuration

**Topics Auto-Created**:
- `raw-events` - All incoming events
- `ready-notifications` - Processed notifications

**Consumer Groups**:
- `notification-processor-group` - Processing service
- `socket-notification-group` - Socket service
- `email-notification-group` - Email service
- `sms-notification-group` - SMS service

**Connection**:
```typescript
const kafka = new Kafka({
  clientId: 'your-service',
  brokers: ['localhost:9092'],
});
```

## 🔍 Troubleshooting

### PostgreSQL Won't Start

```bash
# Check logs
docker-compose logs postgres

# Check if port is already in use
netstat -an | findstr 5432

# Remove old data and restart
docker-compose down -v
docker-compose up -d postgres
```

### Redis Connection Refused

```bash
# Check Redis is running
docker-compose ps redis

# Test connection
docker exec -it notif_redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Kafka Not Ready

```bash
# Wait for Kafka to start (can take 15-30 seconds)
docker-compose logs -f kafka

# Check health
docker exec -it notif_kafka kafka-broker-api-versions --bootstrap-server localhost:9092

# Create topics manually if needed
docker exec -it notif_kafka kafka-topics --create --topic raw-events --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```

### DynamoDB Not Responding

```bash
# Check logs
docker-compose logs dynamodb

# Test endpoint
curl http://localhost:8000

# Restart service
docker-compose restart dynamodb
```

## 🔐 Production Deployment

For production deployments:

1. **Change Default Credentials**:
   ```yaml
   environment:
     POSTGRES_USER: ${DB_USER}
     POSTGRES_PASSWORD: ${DB_PASSWORD}
   ```

2. **Use Docker Secrets** (Docker Swarm):
   ```yaml
   secrets:
     - db_password
   ```

3. **Enable TLS/SSL**:
   - Configure PostgreSQL SSL
   - Use Redis TLS
   - Enable Kafka SASL/SSL

4. **Add Resource Limits**:
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

5. **Use External Volumes**:
   ```yaml
   volumes:
     postgres_data:
       driver: local
       driver_opts:
         type: nfs
         o: addr=nfs-server,rw
         device: ":/path/to/data"
   ```

6. **Remove Development UIs** - Already commented out ✅

## 📈 Performance Tuning

### PostgreSQL

Edit connection pool in services:
```typescript
// Prisma datasource
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 10
}
```

### Redis

Increase memory limit in docker-compose.yml:
```yaml
command: >
  redis-server
  --maxmemory 512mb
```

### Kafka

Increase partitions for better throughput:
```bash
docker exec -it notif_kafka kafka-topics --alter --topic raw-events --partitions 6 --bootstrap-server localhost:9092
```

## 🧪 Testing

### Test All Connections

```bash
# PostgreSQL
docker exec -it notif_postgres psql -U admin -d notification_system -c "SELECT version();"

# Redis
docker exec -it notif_redis redis-cli set test "hello" && docker exec -it notif_redis redis-cli get test

# Kafka
docker exec -it notif_kafka kafka-console-producer --topic test --bootstrap-server localhost:9092
# Type a message and press Ctrl+C

docker exec -it notif_kafka kafka-console-consumer --topic test --bootstrap-server localhost:9092 --from-beginning
```

## 📝 Maintenance

### Backup PostgreSQL

```bash
docker exec -it notif_postgres pg_dump -U admin notification_system > backup.sql
```

### Restore PostgreSQL

```bash
cat backup.sql | docker exec -i notif_postgres psql -U admin -d notification_system
```

### Backup Redis

```bash
docker exec -it notif_redis redis-cli BGSAVE
docker cp notif_redis:/data/dump.rdb ./redis-backup.rdb
```

### View Kafka Topics

```bash
docker exec -it notif_kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Monitor Kafka Consumer Lag

```bash
docker exec -it notif_kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group notification-processor-group
```

## 🎯 Migration from Old Setup

If you were using the old docker-compose with UI services:

1. **Stop old containers**:
   ```bash
   docker-compose down
   ```

2. **Update docker-compose.yml** (already done ✅)

3. **Update DATABASE_URL** in all .env files:
   ```
   OLD: postgresql://admin:password123@localhost:5432/notification_users
   NEW: postgresql://admin:password123@localhost:5432/notification_system
   ```

4. **Start new containers**:
   ```bash
   docker-compose up -d
   ```

5. **Run Prisma migrations**:
   ```bash
   cd backend/processing-service
   npx prisma migrate dev
   ```

6. **No UI configuration needed** - Everything works automatically! 🎉

## ✅ Verification Checklist

After starting Docker Compose:

- [ ] All containers running: `docker-compose ps`
- [ ] PostgreSQL healthy: `docker exec -it notif_postgres pg_isready`
- [ ] Redis responsive: `docker exec -it notif_redis redis-cli ping`
- [ ] Kafka accepting connections: `docker exec -it notif_kafka kafka-broker-api-versions --bootstrap-server localhost:9092`
- [ ] Services can connect to databases
- [ ] Prisma migrations completed
- [ ] Application starts without errors

---

**Questions?** Check logs with `docker-compose logs -f [service-name]`
