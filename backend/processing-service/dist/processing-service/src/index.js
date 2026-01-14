"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const kafkajs_1 = require("kafkajs");
const aggregationService_1 = require("./services/aggregationService");
const batchWriteService_1 = require("./services/batchWriteService");
const dynamoService_1 = require("./services/dynamoService");
const preferenceService_1 = require("./services/preferenceService");
const types_1 = require("../../shared/types");
const initTopics_1 = require("./config/initTopics");
const client_1 = require("@prisma/client");
// Make env loading deterministic even when started from a different cwd (e.g. scripts/start-all.js)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
const prisma = new client_1.PrismaClient();
/**
 * Determine delivery channels based on notification priority
 * CRITICAL: All channels (maximum reach for security/OTP)
 * HIGH: Email + Push (social notifications)
 * LOW: Push only (marketing, digest)
 */
function getChannelsForPriority(priority) {
    switch (priority) {
        case 'CRITICAL':
            return ['PUSH', 'EMAIL', 'SMS']; // Maximum reach for critical alerts
        case 'HIGH':
            return ['PUSH', 'EMAIL']; // Email + Push for social interactions
        case 'LOW':
            return ['PUSH']; // Push only to minimize costs
        default:
            return ['PUSH']; // Fallback to push only
    }
}
const kafka = new kafkajs_1.Kafka({
    clientId: 'processing-service',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    logLevel: kafkajs_1.logLevel.ERROR,
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
function attachConsumerLifecycleLogs(consumer, name) {
    const events = consumer.events;
    if (!events || typeof consumer.on !== 'function')
        return;
    consumer.on(events.CONNECT, () => console.log(`🔌 [${name}] CONNECT`));
    consumer.on(events.DISCONNECT, () => console.log(`🔌 [${name}] DISCONNECT`));
    consumer.on(events.STOP, () => console.log(`⏹️  [${name}] STOP`));
    consumer.on(events.GROUP_JOIN, (e) => {
        const assignment = e?.payload?.memberAssignment || {};
        console.log(`👥 [${name}] GROUP_JOIN`, JSON.stringify(assignment));
    });
    consumer.on(events.CRASH, (e) => {
        const errMsg = e?.payload?.error?.message || e?.payload?.error || 'unknown crash';
        console.error(`💥 [${name}] CRASH:`, errMsg);
        // In dev we prefer a hard restart over silently running with no consumers.
        // nodemon will restart the process.
        setTimeout(() => process.exit(1), 250);
    });
}
function safeParseEvent(rawValue, source) {
    try {
        return JSON.parse(rawValue);
    }
    catch (e) {
        console.error(`❌ Failed to JSON.parse message (${source}). Raw (first 200): ${rawValue.substring(0, 200)}`);
        return null;
    }
}
/**
 * Process notification event with aggregation and filtering
 */
async function processNotificationEvent(event) {
    console.log(`\n📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📥 INCOMING: ${event.type} | Priority: ${event.priority}`);
    console.log(`📥 Target User: ${event.targetId}`);
    console.log(`📥 Actor: ${event.actorName || event.actorId}`);
    console.log(`📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    try {
        // 1. Preference Check (DND, muted categories, etc.)
        const isPreferred = await (0, preferenceService_1.checkUserPreferences)(event.targetId, event.type);
        if (!isPreferred) {
            await (0, dynamoService_1.logNotification)(event, 'FILTERED_PREFS');
            console.log(`🚫 Filtered by preferences: ${event.type} for ${event.targetId}`);
            return;
        }
        // 2. Aggregation Check (for social notifications)
        const aggregationResult = await (0, aggregationService_1.addToAggregationWindow)(event);
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
            const aggregatedMessage = (0, aggregationService_1.generateAggregatedMessage)(event.type, agg.actorNames, agg.count);
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
        await producer.send({
            topic: types_1.KAFKA_TOPICS.READY,
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
        await (0, dynamoService_1.logNotification)(finalEvent, 'SENT');
        // 7. Save to PostgreSQL for persistence
        try {
            await prisma.notificationHistory.create({
                data: {
                    userId: finalEvent.targetId,
                    type: finalEvent.type,
                    priority: finalEvent.priority,
                    actorId: finalEvent.actorId,
                    actorName: finalEvent.actorName || 'Someone',
                    actorAvatar: finalEvent.actorAvatar,
                    isAggregated: !!finalEvent.metadata?.isAggregated,
                    aggregatedCount: finalEvent.metadata?.aggregatedCount || 1,
                    aggregatedIds: finalEvent.metadata?.aggregatedActors || [],
                    title: finalEvent.title || 'New notification',
                    message: finalEvent.message || '',
                    imageUrl: finalEvent.imageUrl,
                    targetType: finalEvent.targetType,
                    targetId: finalEvent.targetEntityId,
                    isRead: false,
                    deliveryStatus: 'SENT',
                    channels: finalEvent.metadata?.channels || [],
                }
            });
            console.log(`💾 Saved to PostgreSQL: ${finalEvent.id}`);
        }
        catch (dbError) {
            console.error(`❌ PostgreSQL save error:`, dbError);
            // Don't fail the entire operation if DB save fails
        }
        console.log(`\n✅ ════════════════════════════════════════════════`);
        console.log(`✅ DELIVERED: ${event.type} | Priority: ${finalEvent.priority}`);
        console.log(`✅ Target: ${event.targetId}`);
        console.log(`✅ Message: ${finalEvent.message?.substring(0, 50)}...`);
        console.log(`✅ ════════════════════════════════════════════════\n`);
    }
    catch (error) {
        console.error(`❌ Error processing event:`, error);
        await (0, dynamoService_1.logNotification)(event, 'FAILED');
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
        topic: types_1.KAFKA_TOPICS.CRITICAL,
        fromBeginning: true // Read from beginning to catch all messages
    });
    await criticalConsumer.run({
        partitionsConsumedConcurrently: 3,
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const rawValue = message.value?.toString();
                if (!rawValue)
                    return;
                const event = safeParseEvent(rawValue, `${topic}/${partition}/${message.offset}`);
                if (!event)
                    return;
                await processNotificationEvent(event);
            }
            catch (err) {
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
    console.log('🟡 Connected! Subscribing to topic:', types_1.KAFKA_TOPICS.HIGH);
    await highPriorityConsumer.subscribe({
        topic: types_1.KAFKA_TOPICS.HIGH,
        fromBeginning: true // Read from beginning to catch all messages
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
                if (!event)
                    return;
                console.log(`   Event Type: ${event.type} | Priority: ${event.priority}`);
                await processNotificationEvent(event);
            }
            catch (err) {
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
        topic: types_1.KAFKA_TOPICS.LOW,
        fromBeginning: true // Read from beginning to catch all messages
    });
    await lowPriorityConsumer.run({
        partitionsConsumedConcurrently: 1,
        eachMessage: async ({ topic, partition, message }) => {
            try {
                const rawValue = message.value?.toString();
                if (!rawValue)
                    return;
                const event = safeParseEvent(rawValue, `${topic}/${partition}/${message.offset}`);
                if (!event)
                    return;
                await processNotificationEvent(event);
            }
            catch (err) {
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
        await (0, aggregationService_1.flushExpiredWindows)(async (aggregatedData) => {
            // 1. BATCH WRITE TO DATABASE FIRST
            const agg = aggregatedData;
            console.log(`\n📦 ════════════════════════════════════════════════`);
            console.log(`📦 BATCH PROCESSING ${agg.count} ${agg.firstEvent.type} events`);
            console.log(`📦 ════════════════════════════════════════════════`);
            // Execute batch database write
            const writeResult = await (0, batchWriteService_1.executeBatchWrite)(agg.allEvents);
            console.log(`📦 DB Write Result: ${writeResult.written} written, ${writeResult.errors} errors`);
            // 2. SEND AGGREGATED NOTIFICATION
            const aggregatedMessage = (0, aggregationService_1.generateAggregatedMessage)(agg.firstEvent.type, agg.actorNames, agg.count);
            // Determine priority based on aggregation count
            let priority = agg.firstEvent.priority;
            if ((agg.count >= 3 && agg.count <= 10) &&
                (agg.firstEvent.type === 'LIKE' || agg.firstEvent.type === 'COMMENT')) {
                priority = 'CRITICAL';
            }
            const finalEvent = {
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
                topic: types_1.KAFKA_TOPICS.READY,
                messages: [{
                        key: finalEvent.targetId,
                        value: JSON.stringify(finalEvent),
                        headers: {
                            priority: Buffer.from(priority),
                            type: Buffer.from(finalEvent.type),
                        },
                    }],
            });
            // Save to PostgreSQL
            try {
                await prisma.notificationHistory.create({
                    data: {
                        userId: finalEvent.targetId,
                        type: finalEvent.type,
                        priority: finalEvent.priority,
                        actorId: finalEvent.actorId,
                        actorName: finalEvent.actorName || 'Someone',
                        actorAvatar: finalEvent.actorAvatar,
                        isAggregated: true,
                        aggregatedCount: agg.count,
                        aggregatedIds: agg.actors,
                        title: finalEvent.title || 'New notification',
                        message: finalEvent.message || '',
                        imageUrl: finalEvent.imageUrl,
                        targetType: finalEvent.targetType,
                        targetId: finalEvent.targetEntityId,
                        isRead: false,
                        deliveryStatus: 'SENT',
                        channels: finalEvent.metadata?.channels || [],
                    }
                });
                console.log(`💾 Aggregated notification saved to PostgreSQL`);
            }
            catch (dbError) {
                console.error(`❌ PostgreSQL save error:`, dbError);
            }
            console.log(`\n✅ ════════════════════════════════════════════════`);
            console.log(`✅ AGGREGATED DELIVERED: ${agg.count} ${agg.firstEvent.type}s`);
            console.log(`✅ Target: ${finalEvent.targetId}`);
            console.log(`✅ Message: ${aggregatedMessage}`);
            console.log(`✅ ════════════════════════════════════════════════\n`);
        });
    }, 30000); // 30 seconds
    console.log('⏰ Aggregation flush job started (30s interval)');
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
        await (0, initTopics_1.ensureTopicsExist)(kafka);
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
    }
    catch (error) {
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
