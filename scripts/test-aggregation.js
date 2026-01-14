/**
 * Aggregation Testing Script
 * 
 * This script:
 * 1. Creates 15 test likes via social-api
 * 2. Checks Redis for aggregation keys immediately
 * 3. Waits for the aggregation window to expire (~70 seconds)
 * 4. Verifies that flush occurred (expired window was processed)
 * 
 * Usage: node scripts/test-aggregation.js
 */

const axios = require('axios');
const Redis = require('ioredis');

// Configuration
const SOCIAL_API_URL = 'http://localhost:3003';
const REDIS_URL = 'redis://localhost:6379';
const AGGREGATION_WINDOW_SECONDS = 60;
const WAIT_BUFFER_SECONDS = 10;

const redis = new Redis(REDIS_URL);

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function getCurrentWindowId() {
  return Math.floor(Date.now() / (AGGREGATION_WINDOW_SECONDS * 1000));
}

async function scanRedisKeys(pattern) {
  const keys = [];
  let cursor = '0';
  
  do {
    const [newCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;
    keys.push(...batch);
  } while (cursor !== '0');
  
  return keys;
}

async function getRedisKeyDetails(keys) {
  const details = [];
  
  for (const key of keys) {
    const type = await redis.type(key);
    let count = 0;
    
    if (type === 'zset') {
      count = await redis.zcard(key);
    } else if (type === 'list') {
      count = await redis.llen(key);
    }
    
    const ttl = await redis.ttl(key);
    
    details.push({ key, type, count, ttl });
  }
  
  return details;
}

async function createTestUser() {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 0a: Creating test user and post`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  try {
    // Register a test user
    const timestamp = Date.now();
    const userResponse = await axios.post(
      `${SOCIAL_API_URL}/api/auth/register`,
      {
        email: `testuser${timestamp}@test.com`,
        username: `testuser${timestamp}`,
        password: 'testpass123',
        name: 'Test User'
      }
    );
    
    const { token, user } = userResponse.data;
    log(`✅ Created test user: ${user.username} (${user.id})`, colors.green);
    
    // Create a test post
    const postResponse = await axios.post(
      `${SOCIAL_API_URL}/api/posts`,
      {
        caption: 'Test post for aggregation testing',
        imageUrl: 'https://via.placeholder.com/400'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const post = postResponse.data.post;
    log(`✅ Created test post: ${post.id}`, colors.green);
    
    return { userId: user.id, postId: post.id };
  } catch (error) {
    log(`❌ Failed to create test data: ${error.message}`, colors.red);
    if (error.response) {
      log(`   Status: ${error.response.status}`, colors.red);
      log(`   Data: ${JSON.stringify(error.response.data)}`, colors.red);
    }
    throw error;
  }
}

async function createTestLikes(postId, targetUserId, count = 15) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 1: Creating ${count} test likes`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  try {
    const response = await axios.post(
      `${SOCIAL_API_URL}/api/test/simulate-likes`,
      {
        postId,
        targetUserId,
        count,
      }
    );
    
    log(`✅ Successfully created ${count} test likes`, colors.green);
    log(`   Post ID: ${postId}`, colors.blue);
    log(`   Target User: ${targetUserId}`, colors.blue);
    
    return response.data;
  } catch (error) {
    log(`❌ Failed to create test likes: ${error.message}`, colors.red);
    if (error.response) {
      log(`   Status: ${error.response.status}`, colors.red);
      log(`   Data: ${JSON.stringify(error.response.data)}`, colors.red);
    }
    throw error;
  }
}

async function checkRedisAggregationKeys(windowId) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 2: Checking Redis for aggregation keys`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  const currentPattern = `agg:*:${windowId}`;
  log(`   Pattern: ${currentPattern}`, colors.blue);
  
  const keys = await scanRedisKeys(currentPattern);
  
  if (keys.length === 0) {
    log(`⚠️  No aggregation keys found for window ${windowId}`, colors.yellow);
    log(`   This means processing-service is NOT consuming Kafka events!`, colors.red);
    return { keys: [], details: [] };
  }
  
  log(`✅ Found ${keys.length} aggregation keys`, colors.green);
  
  const details = await getRedisKeyDetails(keys);
  
  for (const detail of details) {
    log(`\n   Key: ${detail.key}`, colors.blue);
    log(`   Type: ${detail.type} | Count: ${detail.count} | TTL: ${detail.ttl}s`, colors.blue);
  }
  
  return { keys, details };
}

async function waitForWindowExpiry(windowId, waitSeconds) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 3: Waiting for aggregation window to expire`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  log(`   Current Window ID: ${windowId}`, colors.blue);
  log(`   Waiting ${waitSeconds} seconds for window to close...`, colors.yellow);
  
  const startTime = Date.now();
  
  // Show progress every 10 seconds
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const remaining = waitSeconds - elapsed;
    log(`   ⏳ ${elapsed}s elapsed, ${remaining}s remaining...`, colors.yellow);
  }, 10000);
  
  await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
  
  clearInterval(progressInterval);
  
  const newWindowId = getCurrentWindowId();
  log(`✅ Wait complete! Window has rolled over.`, colors.green);
  log(`   Old Window ID: ${windowId}`, colors.blue);
  log(`   New Window ID: ${newWindowId}`, colors.blue);
  
  return newWindowId;
}

async function verifyFlush(oldWindowId, newWindowId) {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 4: Verifying flush occurred`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  // Check if old window keys still exist
  const oldPattern = `agg:*:${oldWindowId}`;
  const oldKeys = await scanRedisKeys(oldPattern);
  
  log(`   Old window pattern: ${oldPattern}`, colors.blue);
  log(`   Old keys remaining: ${oldKeys.length}`, colors.blue);
  
  if (oldKeys.length > 0) {
    log(`⚠️  Old window keys still exist (not yet flushed)`, colors.yellow);
    const details = await getRedisKeyDetails(oldKeys);
    for (const detail of details) {
      log(`   - ${detail.key} (TTL: ${detail.ttl}s)`, colors.yellow);
    }
  } else {
    log(`✅ Old window keys have been flushed!`, colors.green);
  }
  
  // Check current window
  const currentPattern = `agg:*:${newWindowId}`;
  const currentKeys = await scanRedisKeys(currentPattern);
  
  log(`\n   Current window pattern: ${currentPattern}`, colors.blue);
  log(`   Current keys: ${currentKeys.length}`, colors.blue);
  
  return {
    oldKeysRemaining: oldKeys.length,
    currentKeys: currentKeys.length,
    flushed: oldKeys.length === 0,
  };
}

async function checkProcessingServiceLogs() {
  log(`\n${'='.repeat(60)}`, colors.bright);
  log(`STEP 5: Instructions for verifying processing-service`, colors.cyan);
  log('='.repeat(60), colors.bright);
  
  log(`\n📋 Check processing-service logs for these messages:`, colors.yellow);
  log(`   1. "🔔 HIGH PRIORITY MESSAGE RECEIVED" (should appear 15 times)`, colors.blue);
  log(`   2. "⏳ QUEUED IN AGGREGATION WINDOW" (for likes 3-15)`, colors.blue);
  log(`   3. "📬 WINDOW EXPIRED - SENDING AGGREGATED NOTIFICATION" (after ~60s)`, colors.blue);
  log(`   4. "📦 BATCH PROCESSING X LIKE events" (batch DB write)`, colors.blue);
  log(`   5. "✅ AGGREGATED DELIVERED: X LIKEs" (final delivery)`, colors.blue);
}

async function runTest() {
  log(`\n${'═'.repeat(60)}`, colors.bright);
  log(`🧪 AGGREGATION TESTING SCRIPT`, colors.cyan);
  log('═'.repeat(60), colors.bright);
  
  const startTime = Date.now();
  
  try {
    // Step 0: Create real test user and post
    const { userId: targetUserId, postId } = await createTestUser();
    
    // Get current window ID before creating likes
    const initialWindowId = getCurrentWindowId();
    log(`\n📊 Initial Window ID: ${initialWindowId}`, colors.blue);
    
    // Step 1: Create 15 test likes
    await createTestLikes(postId, targetUserId, 15);
    
    // Wait a bit for Kafka/processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: Check Redis immediately
    const { keys, details } = await checkRedisAggregationKeys(initialWindowId);
    
    if (keys.length === 0) {
      log(`\n❌ TEST FAILED: No aggregation keys created`, colors.red);
      log(`   This indicates processing-service is not consuming Kafka messages.`, colors.red);
      log(`   Check that processing-service is running and connected.`, colors.yellow);
      await redis.quit();
      process.exit(1);
    }
    
    // Step 3: Wait for window to expire
    const waitTime = AGGREGATION_WINDOW_SECONDS + WAIT_BUFFER_SECONDS;
    const newWindowId = await waitForWindowExpiry(initialWindowId, waitTime);
    
    // Step 4: Verify flush
    const result = await verifyFlush(initialWindowId, newWindowId);
    
    // Step 5: Show verification instructions
    await checkProcessingServiceLogs();
    
    // Final summary
    const totalTime = Math.floor((Date.now() - startTime) / 1000);
    
    log(`\n${'═'.repeat(60)}`, colors.bright);
    log(`TEST SUMMARY`, colors.cyan);
    log('═'.repeat(60), colors.bright);
    
    log(`\n✅ Test completed in ${totalTime} seconds`, colors.green);
    log(`\nResults:`, colors.blue);
    log(`   - Aggregation keys created: ${details.length > 0 ? 'YES ✅' : 'NO ❌'}`, 
        details.length > 0 ? colors.green : colors.red);
    log(`   - Window flushed: ${result.flushed ? 'YES ✅' : 'NO ❌'}`, 
        result.flushed ? colors.green : colors.red);
    log(`   - Old keys remaining: ${result.oldKeysRemaining}`, colors.blue);
    log(`   - Current window keys: ${result.currentKeys}`, colors.blue);
    
    if (result.flushed && details.length > 0) {
      log(`\n🎉 SUCCESS! Aggregation and flush working correctly!`, colors.green);
    } else {
      log(`\n⚠️  PARTIAL SUCCESS or FAILURE - Check details above`, colors.yellow);
    }
    
    log(`\n${'═'.repeat(60)}`, colors.bright);
    
  } catch (error) {
    log(`\n❌ Test failed with error: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await redis.quit();
  }
}

// Run the test
runTest().catch(console.error);
