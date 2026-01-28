import dotenv from 'dotenv';
import path from 'path';
import { Kafka, logLevel, Consumer, Producer } from 'kafkajs';
import {
  addToAggregationWindow,
  flushExpiredWindows,
  generateAggregatedMessage
} from './services/aggregationService';
import { executeBatchWrite, batchWriteNotificationHistory } from './services/batchWriteService';
import { logNotification } from './services/dynamoService';
import { checkUserPreferences } from './services/preferenceService';
import { NotificationEvent, NotificationPriority, KAFKA_TOPICS } from '../../shared/types';
import { ensureTopicsExist } from './config/initTopics';
import { PrismaClient } from '../../shared/prisma/generated/client';

// Make env loading deterministic even when started from a different cwd (e.g. scripts/start-all.js)
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });
// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('💀 UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💀 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  // Don't exit - just log so consumer keeps running
});

const prisma = new PrismaClient();

/**
 * Determine delivery channels based on notification priority
 * CRITICAL: All channels (maximum reach for security/OTP)
 * HIGH: Email + Push (social notifications)
 * LOW: Push only (marketing, digest)
 */
function getChannelsForPriority(priority: NotificationPriority): ('PUSH' | 'EMAIL' | 'SMS')[] {
  switch (priority) {
    case 'CRITICAL':
      return ['PUSH', 'EMAIL', 'SMS'];  // Maximum reach for critical alerts
    case 'HIGH':
      return ['PUSH', 'EMAIL'];         // Email + Push for social interactions
    case 'LOW':
      return ['PUSH'];                  // Push only to minimize costs
    default:
      return ['PUSH'];                  // Fallback to push only
  }
}

const kafka = new Kafka({
  clientId: 'processing-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Create 3 consumer groups for priority-based processing
const criticalConsumer = kafka.consumer({
  groupId: 'critical-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

const highPriorityConsumer = kafka.consumer({
  groupId: 'high-priority-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

const lowPriorityConsumer = kafka.consumer({
  groupId: 'low-priority-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

const producer = kafka.producer();

function attachConsumerLifecycleLogs(consumer: Consumer, name: string) {
  const events = (consumer as any).events;
  if (!events || typeof (consumer as any).on !== 'function') return;

  (consumer as any).on(events.CONNECT, () => console.log(`🔌 [${name}] CONNECT`));
  (consumer as any).on(events.DISCONNECT, () => console.log(`🔌 [${name}] DISCONNECT`));
  (consumer as any).on(events.STOP, () => console.log(`⏹️  [${name}] STOP`));
  (consumer as any).on(events.GROUP_JOIN, (e: any) => {
    const assignment = e?.payload?.memberAssignment || {};
    console.log(`👥 [${name}] GROUP_JOIN`, JSON.stringify(assignment));
  });
  (consumer as any).on(events.CRASH, (e: any) => {
    const errMsg = e?.payload?.error?.message || e?.payload?.error || 'unknown crash';
    console.error(`💥 [${name}] CRASH:`, errMsg);
    // CRITICAL: Force immediate exit so nodemon restarts everything.
    // Without this, other consumers keep running but this one stays dead.
    console.error(`🔥 FATAL: Consumer ${name} crashed - forcing process exit for clean restart`);
    process.exit(1);
  });
}

function safeParseEvent(rawValue: string, source: string): NotificationEvent | null {
  try {
    return JSON.parse(rawValue) as NotificationEvent;
  } catch (e) {
    console.error(`❌ Failed to JSON.parse message (${source}). Raw (first 200): ${rawValue.substring(0, 200)}`);
    return null;
  }
}

/**
 * Process notification event with aggregation and filtering
 */
async function processNotificationEvent(event: NotificationEvent): Promise<void> {
  const startTime = Date.now();

  console.log(`\n📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📥 INCOMING: ${event.type} | Priority: ${event.priority}`);
  console.log(`📥 Target User: ${event.targetId}`);
  console.log(`📥 Actor: ${event.actorName || event.actorId}`);
  console.log(`📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  try {
    // 1. Preference Check (DND, muted categories, etc.)
    console.log(`📥 Step 1: Checking preferences...`);
    let isPreferred = true;
    try {
      isPreferred = await checkUserPreferences(event.targetId, event.type);
    } catch (prefError) {
      console.error(`⚠️ Preference check failed, allowing by default:`, prefError);
    }

    if (!isPreferred) {
      try { await logNotification(event, 'FILTERED_PREFS'); } catch { }
      console.log(`🚫 Filtered by preferences: ${event.type} for ${event.targetId}`);
      return;
    }

    // 2. Aggregation Check (for social notifications)
    console.log(`📥 Step 2: Checking aggregation...`);
    const aggregationResult = await addToAggregationWindow(event);

    if (!aggregationResult.shouldSendNow) {
      // Added to aggregation window, wait for flush
      console.log(`⏳ Added to aggregation window: ${event.type} for ${event.targetId}`);
      return;
    }

    // 3. Prepare notification for delivery
    let finalEvent = event;

    if (aggregationResult.aggregatedData) {
      // Build aggregated notification
      const agg = aggregationResult.aggregatedData;
      const aggregatedMessage = generateAggregatedMessage(
        event.type,
        agg.actorNames,
        agg.count
      );

      // Determine priority based on aggregation count
      // 3-4 likes/interactions = CRITICAL (sweet spot for engagement)
      let priority = agg.firstEvent.priority;
      if ((agg.count === 3 || agg.count === 4) && event.type === 'LIKE') {
        priority = 'CRITICAL';
        console.log(`🔥 CRITICAL priority: ${agg.count} likes on post`);
      }

      finalEvent = {
        ...agg.firstEvent,
        priority,
        message: aggregatedMessage,
        title: `${agg.count} new ${event.type.toLowerCase()}${agg.count > 1 ? 's' : ''}`,
        actorId: agg.actors[0],
        actorName: agg.actorNames[0],
        actorAvatar: agg.actorAvatars[0],
        timestamp: agg.lastTimestamp,
        metadata: {
          ...agg.firstEvent.metadata,
          isAggregated: true,
          aggregatedCount: agg.count,
          aggregatedActors: agg.actors,
        },
      };

      console.log(`📊 Aggregated notification: ${agg.count} events | Priority: ${priority}`);
    }

    // 4. Determine delivery channels based on priority
    const channels = getChannelsForPriority(finalEvent.priority);

    // Add channels to metadata
    finalEvent = {
      ...finalEvent,
      metadata: {
        ...finalEvent.metadata,
        channels: channels,
      },
    };

    console.log(`📡 [${finalEvent.priority}] Delivery Channels: [${channels.join(', ')}]`);

    // 5. Send to delivery topic
    console.log(`📤 Sending to ready-notifications...`);
    await producer.send({
      topic: KAFKA_TOPICS.READY,
      messages: [{
        key: finalEvent.targetId,
        value: JSON.stringify(finalEvent),
        headers: {
          priority: Buffer.from(finalEvent.priority),
          type: Buffer.from(finalEvent.type),
        },
      }],
    });
    console.log(`📤 Sent to ready-notifications!`);

    // 6. Log to DynamoDB (fire and forget - non-blocking)
    logNotification(finalEvent, 'SENT');

    // 7. BATCHING: Notification history will be written during window flush
    // This reduces DB writes from N (every notification) to 1 (per 60s window)
    // Notifications are still visible on frontend via WebSocket
    console.log(`⏳ Notification queued for batch DB write (60s window)`);


    const duration = Date.now() - startTime;
    console.log(`\n✅ ════════════════════════════════════════════════`);
    console.log(`✅ DELIVERED: ${event.type} | Priority: ${finalEvent.priority}`);
    console.log(`✅ Target: ${event.targetId}`);
    console.log(`✅ Message: ${finalEvent.message?.substring(0, 50)}...`);
    console.log(`✅ Duration: ${duration}ms`);
    console.log(`✅ ════════════════════════════════════════════════\n`);

  } catch (error) {
    console.error(`❌ Error processing event:`, error);
    try { await logNotification(event, 'FAILED'); } catch { }
  }
}
/**
 * Start critical priority consumer (P0)
 * Processes: OTP, PASSWORD_RESET, SECURITY_ALERT
 * Poll Interval: 100ms (fastest)
 */
async function startCriticalConsumer() {
  attachConsumerLifecycleLogs(criticalConsumer, 'critical-consumer');
  await criticalConsumer.connect();
  await criticalConsumer.subscribe({
    topic: KAFKA_TOPICS.CRITICAL,
    fromBeginning: true  // Read from beginning to catch all messages
  });

  await criticalConsumer.run({
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const rawValue = message.value?.toString();
        if (!rawValue) return;
        const event = safeParseEvent(rawValue, `${topic}/${partition}/${message.offset}`);
        if (!event) return;
        await processNotificationEvent(event);
      } catch (err) {
        console.error('❌ Critical consumer eachMessage error:', err);
      }
    },
  });

  console.log('🔴 Critical Consumer (P0) started');
}

/**
 * Start high priority consumer (P1)
 * Processes: LIKE, COMMENT, FOLLOW, BELL_POST, etc.
 * Poll Interval: 500ms
 */
async function startHighPriorityConsumer() {
  console.log('🟡 Connecting high-priority-consumer...');
  attachConsumerLifecycleLogs(highPriorityConsumer, 'high-priority-consumer');
  await highPriorityConsumer.connect();
  console.log('🟡 Connected! Subscribing to topic:', KAFKA_TOPICS.HIGH);

  await highPriorityConsumer.subscribe({
    topic: KAFKA_TOPICS.HIGH,
    fromBeginning: true  // Read from beginning to catch all messages
  });
  console.log('🟡 Subscribed with fromBeginning: true');

  await highPriorityConsumer.run({
    partitionsConsumedConcurrently: 2,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        console.log(`\n🔔 HIGH PRIORITY MESSAGE RECEIVED`);
        console.log(`   Topic: ${topic} | Partition: ${partition} | Offset: ${message.offset}`);

        const rawValue = message.value?.toString();
        if (!rawValue) {
          console.log(`   ⚠️ Empty message`);
          return;
        }

        console.log(`   Raw: ${rawValue.substring(0, 100)}...`);
        const event = safeParseEvent(rawValue, `${topic}/${partition}/${message.offset}`);
        if (!event) return;
        console.log(`   Event Type: ${event.type} | Priority: ${event.priority}`);
        await processNotificationEvent(event);
      } catch (err) {
        console.error('❌ High priority consumer eachMessage error:', err);
      }
    },
  });

  console.log('🟡 High Priority Consumer (P1) started and running');
}

/**
 * Start low priority consumer (P2)
 * Processes: MARKETING, DIGEST
 * Poll Interval: 2000ms (slowest)
 */
async function startLowPriorityConsumer() {
  attachConsumerLifecycleLogs(lowPriorityConsumer, 'low-priority-consumer');
  await lowPriorityConsumer.connect();
  await lowPriorityConsumer.subscribe({
    topic: KAFKA_TOPICS.LOW,
    fromBeginning: true  // Read from beginning to catch all messages
  });

  await lowPriorityConsumer.run({
    partitionsConsumedConcurrently: 1,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const rawValue = message.value?.toString();
        if (!rawValue) return;
        const event = safeParseEvent(rawValue, `${topic}/${partition}/${message.offset}`);
        if (!event) return;
        await processNotificationEvent(event);
      } catch (err) {
        console.error('❌ Low priority consumer eachMessage error:', err);
      }
    },
  });

  console.log('🟢 Low Priority Consumer (P2) started');
}

/**
 * Start background job for flushing aggregation windows
 * Runs every 30 seconds
 */
function startAggregationFlushJob() {
  setInterval(async () => {
    await flushExpiredWindows(async (aggregatedData) => {
      // 1. BATCH WRITE TO DATABASE FIRST
      const agg = aggregatedData;

      console.log(`\n📦 ════════════════════════════════════════════════`);
      console.log(`📦 BATCH PROCESSING ${agg.count} ${agg.firstEvent.type} events`);
      console.log(`📦 ════════════════════════════════════════════════`);

      // Execute batch database write
      const writeResult = await executeBatchWrite(agg.allEvents);
      console.log(`📦 DB Write Result: ${writeResult.written} written, ${writeResult.errors} errors`);

      // 2. SEND AGGREGATED NOTIFICATION
      const aggregatedMessage = generateAggregatedMessage(
        agg.firstEvent.type,
        agg.actorNames,
        agg.count
      );

      // Determine priority based on aggregation count
      let priority = agg.firstEvent.priority;
      if ((agg.count >= 3 && agg.count <= 10) &&
        (agg.firstEvent.type === 'LIKE' || agg.firstEvent.type === 'COMMENT')) {
        priority = 'CRITICAL';
      }

      const finalEvent: NotificationEvent = {
        ...agg.firstEvent,
        priority,
        message: aggregatedMessage,
        title: `${agg.count} new ${agg.firstEvent.type.toLowerCase()}${agg.count > 1 ? 's' : ''}`,
        actorId: agg.actors[0],
        actorName: agg.actorNames[0],
        actorAvatar: agg.actorAvatars[0],
        timestamp: agg.lastTimestamp,
        metadata: {
          ...agg.firstEvent.metadata,
          isAggregated: true,
          aggregatedCount: agg.count,
          aggregatedActors: agg.actors,
          channels: getChannelsForPriority(priority),
        },
      };

      console.log(`📤 Sending aggregated notification: ${agg.count} ${agg.firstEvent.type}s`);

      // Send to ready-notifications topic for delivery
      await producer.send({
        topic: KAFKA_TOPICS.READY,
        messages: [{
          key: finalEvent.targetId,
          value: JSON.stringify(finalEvent),
          headers: {
            priority: Buffer.from(priority),
            type: Buffer.from(finalEvent.type),
          },
        }],
      });

      // 3. BATCH WRITE NOTIFICATION HISTORY
      // Write aggregated notification to notification history table
      await batchWriteNotificationHistory(finalEvent);

      console.log(`\n✅ ════════════════════════════════════════════════`);
      console.log(`✅ AGGREGATED DELIVERED: ${agg.count} ${agg.firstEvent.type}s`);
      console.log(`✅ Target: ${finalEvent.targetId}`);
      console.log(`✅ Message: ${aggregatedMessage}`);
      console.log(`✅ ════════════════════════════════════════════════\n`);
    });
  }, 60000); // 60 seconds - checks for windows that expired 2 minutes ago

  console.log('⏰ Aggregation flush job started (60s interval, 2min windows)');
}

/**
 * Main entry point
 */
async function startService() {
  console.log('🧠 Processing Service Starting...');
  console.log('📊 Priority Queue System Enabled');
  console.log('🔧 Kafka Broker:', process.env.KAFKA_BROKER || 'localhost:9092');
  console.log('🔧 Notifications DB URL set:', Boolean(process.env.DATABASE_URL));
  console.log('🔧 Social DB URL set:', Boolean(process.env.SOCIAL_DATABASE_URL));

  try {
    // Ensure Kafka topics exist
    await ensureTopicsExist(kafka);

    // Connect producer
    await producer.connect();
    console.log('✅ Kafka producer connected');

    // Start all consumers SEQUENTIALLY with error handling
    // (Promise.all can hide async errors from consumer.run())
    console.log('\n🚦 Starting consumers sequentially...');

    try {
      await startCriticalConsumer();
    } catch (err) {
      console.error('❌ Critical consumer failed to start:', err);
    }

    try {
      await startHighPriorityConsumer();
    } catch (err) {
      console.error('❌ High priority consumer failed to start:', err);
      // This is critical - exit so nodemon restarts
      throw err;
    }

    try {
      await startLowPriorityConsumer();
    } catch (err) {
      console.error('❌ Low priority consumer failed to start:', err);
    }

    // Start aggregation flush job
    startAggregationFlushJob();

    console.log('🚀 Processing Service Ready!');
    console.log('   - Critical (P0): OTPs, Security');
    console.log('   - High (P1): Social interactions');
    console.log('   - Low (P2): Marketing, Digests');

    // Heartbeat to confirm service is alive
    setInterval(() => {
      console.log(`💓 Heartbeat: ${new Date().toISOString()} - Consumers should be running`);
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Failed to start processing service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await criticalConsumer.disconnect();
  await highPriorityConsumer.disconnect();
  await lowPriorityConsumer.disconnect();
  await producer.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});

startService();