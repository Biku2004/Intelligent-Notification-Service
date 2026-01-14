/**
 * Full Pipeline Diagnostic
 * 
 * Tests every step of the notification pipeline:
 * 1. Kafka producer (send test message)
 * 2. Check message in topic
 * 3. Check consumer groups
 * 4. Check Redis aggregation keys
 * 
 * Usage: node scripts/diagnose-pipeline.js
 */

const { Kafka } = require('kafkajs');
const Redis = require('ioredis');

const KAFKA_BROKER = 'localhost:9092';
const REDIS_URL = 'redis://localhost:6379';

const kafka = new Kafka({
  clientId: 'pipeline-diagnostic',
  brokers: [KAFKA_BROKER],
});

const admin = kafka.admin();
const producer = kafka.producer();
const redis = new Redis(REDIS_URL);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function diagnose() {
  log('\n' + '═'.repeat(60), colors.bright);
  log('🔍 NOTIFICATION PIPELINE DIAGNOSTIC', colors.cyan);
  log('═'.repeat(60), colors.bright);

  const issues = [];

  try {
    // ==========================================
    // STEP 1: Check Kafka Connection
    // ==========================================
    log('\n[1/6] Checking Kafka connection...', colors.yellow);
    await admin.connect();
    log('✅ Connected to Kafka', colors.green);

    // ==========================================
    // STEP 2: Check Topics Exist
    // ==========================================
    log('\n[2/6] Checking topics...', colors.yellow);
    const topics = await admin.listTopics();
    const requiredTopics = [
      'high-priority-notifications',
      'low-priority-notifications',
      'critical-notifications',
      'ready-notifications'
    ];
    
    for (const topic of requiredTopics) {
      if (topics.includes(topic)) {
        log(`   ✅ ${topic}`, colors.green);
      } else {
        log(`   ❌ ${topic} - MISSING!`, colors.red);
        issues.push(`Topic ${topic} is missing`);
      }
    }

    // ==========================================
    // STEP 3: Check Consumer Groups
    // ==========================================
    log('\n[3/6] Checking consumer groups...', colors.yellow);
    const groups = await admin.listGroups();
    const groupIds = groups.groups.map(g => g.groupId);
    
    const requiredGroups = [
      { id: 'high-priority-consumer', critical: true },
      { id: 'low-priority-consumer', critical: false },
      { id: 'critical-consumer', critical: false },
      { id: 'socket-delivery-consumer', critical: true },
    ];

    for (const { id, critical } of requiredGroups) {
      if (groupIds.includes(id)) {
        // Check if it has members
        const described = await admin.describeGroups([id]);
        const group = described.groups[0];
        const memberCount = group.members.length;
        
        if (memberCount > 0) {
          log(`   ✅ ${id} (${memberCount} member(s), state: ${group.state})`, colors.green);
        } else {
          log(`   ⚠️  ${id} (0 members - no active consumer!)`, colors.yellow);
          if (critical) {
            issues.push(`${id} has no active members - consumer not running`);
          }
        }
      } else {
        const icon = critical ? '❌' : '⚠️';
        const color = critical ? colors.red : colors.yellow;
        log(`   ${icon} ${id} - NOT FOUND`, color);
        if (critical) {
          issues.push(`${id} consumer group does not exist`);
        }
      }
    }

    // ==========================================
    // STEP 4: Test Producer
    // ==========================================
    log('\n[4/6] Testing Kafka producer...', colors.yellow);
    await producer.connect();
    
    const testEvent = {
      id: 'diag-' + Date.now(),
      type: 'LIKE',
      priority: 'HIGH',
      actorId: 'diag-actor',
      actorName: 'Diagnostic Test',
      targetId: 'diag-target',
      targetEntityId: 'diag-post',
      timestamp: new Date().toISOString(),
    };

    await producer.send({
      topic: 'high-priority-notifications',
      messages: [{
        key: testEvent.targetId,
        value: JSON.stringify(testEvent),
      }],
    });
    log('   ✅ Sent test message to high-priority-notifications', colors.green);

    // Wait a moment for the message to be available
    await new Promise(r => setTimeout(r, 1000));

    // ==========================================
    // STEP 5: Verify Message in Topic
    // ==========================================
    log('\n[5/6] Checking topic offsets...', colors.yellow);
    const topicOffsets = await admin.fetchTopicOffsets('high-priority-notifications');
    
    let hasMessages = false;
    for (const partition of topicOffsets) {
      const high = parseInt(partition.high || partition.offset || '0');
      if (high > 0) {
        hasMessages = true;
        log(`   Partition ${partition.partition}: ${high} message(s)`, colors.blue);
      }
    }
    
    if (hasMessages) {
      log('   ✅ Messages exist in high-priority-notifications', colors.green);
    } else {
      log('   ⚠️  No messages found in topic (may have been consumed)', colors.yellow);
    }

    // ==========================================
    // STEP 6: Check Redis Connection & Keys
    // ==========================================
    log('\n[6/6] Checking Redis...', colors.yellow);
    await redis.ping();
    log('   ✅ Redis connected', colors.green);

    // Check for aggregation keys
    const aggKeys = await scanRedisKeys('agg:*');
    if (aggKeys.length > 0) {
      log(`   ✅ Found ${aggKeys.length} aggregation key(s)`, colors.green);
      for (const key of aggKeys.slice(0, 5)) {
        const ttl = await redis.ttl(key);
        log(`      - ${key} (TTL: ${ttl}s)`, colors.blue);
      }
    } else {
      log('   ⚠️  No aggregation keys found in Redis', colors.yellow);
      log('      This is OK if no likes have been processed yet', colors.yellow);
    }

    // ==========================================
    // SUMMARY
    // ==========================================
    log('\n' + '═'.repeat(60), colors.bright);
    log('DIAGNOSTIC SUMMARY', colors.cyan);
    log('═'.repeat(60), colors.bright);

    if (issues.length === 0) {
      log('\n✅ All checks passed! Pipeline should be working.', colors.green);
    } else {
      log(`\n❌ Found ${issues.length} issue(s):`, colors.red);
      for (const issue of issues) {
        log(`   • ${issue}`, colors.red);
      }
      
      log('\n💡 Recommended fixes:', colors.yellow);
      
      if (issues.some(i => i.includes('high-priority-consumer'))) {
        log('   1. Restart processing-service:', colors.blue);
        log('      - Stop all services (Ctrl+C)', colors.blue);
        log('      - docker restart notif_kafka', colors.blue);
        log('      - Wait 15 seconds', colors.blue);
        log('      - npm run dev:all', colors.blue);
      }
    }

    log('\n');

  } catch (error) {
    log(`\n❌ Diagnostic failed: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await admin.disconnect().catch(() => {});
    await producer.disconnect().catch(() => {});
    await redis.quit().catch(() => {});
  }
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

diagnose();
