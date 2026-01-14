# Aggregation Testing

This directory contains a comprehensive test script to verify the notification aggregation and batch processing system.

## Test Script: `test-aggregation.js`

### Purpose
Validates that the notification aggregation system is working correctly by:
1. Creating 15 test likes via social-api
2. Verifying Redis aggregation keys are created
3. Waiting for the aggregation window to expire (~60 seconds)
4. Confirming that the flush job processed the aggregated notifications

### Prerequisites
Before running the test, ensure:
- Docker services are running (`docker-compose up -d`)
- Backend services are running (`npm run dev:all`)
- All services are healthy and connected

### Usage

```bash
# From project root
npm run test:aggregation

# Or directly
node scripts/test-aggregation.js
```

### What the Test Does

#### Step 1: Create Test Likes
- Sends HTTP POST to `/api/test/simulate-likes`
- Creates 15 likes for a test post
- Uses unique post ID and target user ID

#### Step 2: Check Redis Keys
- Scans Redis for aggregation keys with pattern `agg:*:<windowId>`
- Displays key details (type, count, TTL)
- **FAIL if no keys found** → processing-service not consuming Kafka

#### Step 3: Wait for Window Expiry
- Waits ~70 seconds (60s window + 10s buffer)
- Shows progress updates every 10 seconds
- Confirms window ID has rolled over

#### Step 4: Verify Flush
- Checks if old window keys were deleted (flushed)
- Displays current window keys if any
- **SUCCESS if old keys are gone** → flush job worked

#### Step 5: Log Verification Instructions
- Reminds you to check processing-service logs for:
  - `🔔 HIGH PRIORITY MESSAGE RECEIVED` (15 times)
  - `⏳ QUEUED IN AGGREGATION WINDOW` (for likes 3-15)
  - `📬 WINDOW EXPIRED - SENDING AGGREGATED NOTIFICATION`
  - `📦 BATCH PROCESSING X LIKE events`
  - `✅ AGGREGATED DELIVERED: X LIKEs`

### Expected Behavior

#### When Everything Works ✅
```
Test completed in ~72 seconds
Results:
   - Aggregation keys created: YES ✅
   - Window flushed: YES ✅
   - Old keys remaining: 0
   - Current window keys: 0

🎉 SUCCESS! Aggregation and flush working correctly!
```

#### When Processing Service Not Consuming ❌
```
⚠️  No aggregation keys found for window 29470771
   This means processing-service is NOT consuming Kafka events!

❌ TEST FAILED: No aggregation keys created
   This indicates processing-service is not consuming Kafka messages.
   Check that processing-service is running and connected.
```

#### When Flush Not Working ⚠️
```
⚠️  Old window keys still exist (not yet flushed)
   - agg:user-id:LIKE:post-id:29470771 (TTL: 45s)

⚠️  PARTIAL SUCCESS or FAILURE - Check details above
```

### Troubleshooting

**Problem: No aggregation keys created**
- Check processing-service logs for `👥 [high-priority-consumer] GROUP_JOIN`
- Run `cd backend/processing-service && node check-kafka.js` to see consumer group status
- Verify Kafka topics exist and have messages

**Problem: Keys created but not flushed**
- Check if flush job is running (processing-service logs should show `⏰ Aggregation flush job started`)
- Verify flush interval is correct (30s in code)
- Check Redis connection in processing-service

**Problem: Social API connection error**
- Ensure social-api is running on port 3003
- Check social-api logs for errors
- Verify test endpoint exists: `POST /api/test/simulate-likes`

### Integration with CI/CD

This test can be integrated into automated testing:

```bash
# Start services
docker-compose up -d
npm run dev:all

# Wait for services to be ready
sleep 10

# Run test
npm run test:aggregation

# Check exit code
if [ $? -eq 0 ]; then
  echo "✅ Aggregation test passed"
else
  echo "❌ Aggregation test failed"
  exit 1
fi
```

### Configuration

The test uses these default values (hardcoded in the script):
- Social API URL: `http://localhost:3003`
- Redis URL: `redis://localhost:6379`
- Aggregation Window: `60 seconds`
- Wait Buffer: `10 seconds`

To modify, edit the constants at the top of `test-aggregation.js`.
