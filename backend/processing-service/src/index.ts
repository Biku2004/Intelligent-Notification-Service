import dotenv from 'dotenv';
import { Kafka, logLevel, Consumer, Producer } from 'kafkajs';
import { 
  addToAggregationWindow, 
  flushExpiredWindows, 
  generateAggregatedMessage 
} from './services/aggregationService';
import { logNotification } from './services/dynamoService';
import { checkUserPreferences } from './services/preferenceService';
import { NotificationEvent, NotificationPriority, KAFKA_TOPICS } from '../../shared/types';
import { ensureTopicsExist } from './config/initTopics';

dotenv.config();

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

/**
 * Process notification event with aggregation and filtering
 */
async function processNotificationEvent(event: NotificationEvent): Promise<void> {
  console.log(`📥 [${event.priority}] Processing: ${event.type} for ${event.targetId}`);

  try {
    // 1. Preference Check (DND, muted categories, etc.)
    const isPreferred = await checkUserPreferences(event.targetId, event.type);
    if (!isPreferred) {
      await logNotification(event, 'FILTERED_PREFS');
      console.log(`🚫 Filtered by preferences: ${event.type} for ${event.targetId}`);
      return;
    }

    // 2. Aggregation Check (for social notifications)
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

      finalEvent = {
        ...agg.firstEvent,
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

      console.log(`📊 Aggregated notification: ${agg.count} events`);
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

    console.log(`📡 [${finalEvent.priority}] Channels: [${channels.join(', ')}]`);

    // 5. Send to delivery topic
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

    // 6. Log to DynamoDB
    await logNotification(finalEvent, 'SENT');
    console.log(`✅ [${event.priority}] Sent: ${event.type} for ${event.targetId}`);

  } catch (error) {
    console.error(`❌ Error processing event:`, error);
    await logNotification(event, 'FAILED');
  }
}

/**
 * Start critical priority consumer (P0)
 * Processes: OTP, PASSWORD_RESET, SECURITY_ALERT
 * Poll Interval: 100ms (fastest)
 */
async function startCriticalConsumer() {
  await criticalConsumer.connect();
  await criticalConsumer.subscribe({ 
    topic: KAFKA_TOPICS.CRITICAL, 
    fromBeginning: false 
  });

  await criticalConsumer.run({
    partitionsConsumedConcurrently: 3,
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event: NotificationEvent = JSON.parse(rawValue);
      await processNotificationEvent(event);
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
  await highPriorityConsumer.connect();
  await highPriorityConsumer.subscribe({ 
    topic: KAFKA_TOPICS.HIGH, 
    fromBeginning: false 
  });

  await highPriorityConsumer.run({
    partitionsConsumedConcurrently: 2,
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event: NotificationEvent = JSON.parse(rawValue);
      await processNotificationEvent(event);
    },
  });

  console.log('🟡 High Priority Consumer (P1) started');
}

/**
 * Start low priority consumer (P2)
 * Processes: MARKETING, DIGEST
 * Poll Interval: 2000ms (slowest)
 */
async function startLowPriorityConsumer() {
  await lowPriorityConsumer.connect();
  await lowPriorityConsumer.subscribe({ 
    topic: KAFKA_TOPICS.LOW, 
    fromBeginning: false 
  });

  await lowPriorityConsumer.run({
    partitionsConsumedConcurrently: 1,
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event: NotificationEvent = JSON.parse(rawValue);
      await processNotificationEvent(event);
    },
  });

  console.log('🟢 Low Priority Consumer (P2) started');
}

/**
 * Start background job for flushing aggregation windows
 * Runs every 60 seconds
 */
function startAggregationFlushJob() {
  setInterval(async () => {
    await flushExpiredWindows();
  }, 30000); // 30 seconds

  console.log('⏰ Aggregation flush job started (30s interval)');
}

/**
 * Main entry point
 */
async function startService() {
  console.log('🧠 Processing Service Starting...');
  console.log('📊 Priority Queue System Enabled');

  try {
    // Ensure Kafka topics exist
    await ensureTopicsExist(kafka);

    // Connect producer
    await producer.connect();
    console.log('✅ Kafka producer connected');

    // Start all consumers
    await Promise.all([
      startCriticalConsumer(),
      startHighPriorityConsumer(),
      startLowPriorityConsumer(),
    ]);

    // Start aggregation flush job
    startAggregationFlushJob();

    console.log('🚀 Processing Service Ready!');
    console.log('   - Critical (P0): OTPs, Security');
    console.log('   - High (P1): Social interactions');
    console.log('   - Low (P2): Marketing, Digests');

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
  process.exit(0);
});

startService();