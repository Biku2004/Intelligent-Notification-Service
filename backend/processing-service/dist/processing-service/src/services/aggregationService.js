"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldAggregate = shouldAggregate;
exports.addToAggregationWindow = addToAggregationWindow;
exports.flushExpiredWindows = flushExpiredWindows;
exports.shouldSendNotification = shouldSendNotification;
exports.generateAggregatedMessage = generateAggregatedMessage;
// Smart Aggregation Service with Redis-based Batching
// Implements: "John and 5 others liked your post" logic
const redis_1 = __importDefault(require("../config/redis"));
const AGGREGATION_WINDOW_SECONDS = 60; // 1 minute
const MAX_BATCH_SIZE = 50;
/**
 * Determines if notification type should be aggregated
 */
function shouldAggregate(type) {
    const aggregatableTypes = [
        'LIKE',
        'COMMENT',
        'COMMENT_REPLY',
        'FOLLOW',
        'POST_SHARE',
        'STORY_VIEW',
    ];
    return aggregatableTypes.includes(type);
}
/**
 * Generate Redis key for aggregation window
 */
function getAggregationKey(key, windowId) {
    const { userId, type, targetEntityId } = key;
    const entityPart = targetEntityId ? `:${targetEntityId}` : '';
    return `agg:${userId}:${type}${entityPart}:${windowId}`;
}
/**
 * Get current aggregation window ID (changes every 2 minutes)
 */
function getCurrentWindowId() {
    return Math.floor(Date.now() / (AGGREGATION_WINDOW_SECONDS * 1000));
}
/**
 * Add event to aggregation window
 * Returns: { shouldSendNow: boolean, aggregatedData?: AggregatedData }
 */
async function addToAggregationWindow(event) {
    if (!shouldAggregate(event.type)) {
        return { shouldSendNow: true };
    }
    const windowId = getCurrentWindowId();
    const key = {
        userId: event.targetId,
        type: event.type,
        targetEntityId: event.targetEntityId,
    };
    const redisKey = getAggregationKey(key, windowId);
    const metaKey = `${redisKey}:meta`;
    const eventsKey = `${redisKey}:events`; // Store all events for batch writes
    try {
        // Add actor to sorted set (score = timestamp)
        const timestamp = new Date(event.timestamp).getTime();
        await redis_1.default.zadd(redisKey, timestamp, event.actorId);
        // Store all events for batch DB writes
        await redis_1.default.rpush(eventsKey, JSON.stringify(event));
        await redis_1.default.expire(eventsKey, AGGREGATION_WINDOW_SECONDS + 10);
        // Store metadata about first event
        const exists = await redis_1.default.exists(metaKey);
        if (!exists) {
            await redis_1.default.set(metaKey, JSON.stringify({
                firstEvent: event,
                actorNames: [event.actorName || event.actorId],
                actorAvatars: [event.actorAvatar || ''],
            }), 'EX', AGGREGATION_WINDOW_SECONDS + 10 // Extra buffer
            );
        }
        else {
            // Update actor metadata
            const meta = JSON.parse((await redis_1.default.get(metaKey)) || '{}');
            if (event.actorName && !meta.actorNames.includes(event.actorName)) {
                meta.actorNames.push(event.actorName);
                meta.actorAvatars.push(event.actorAvatar || '');
                await redis_1.default.set(metaKey, JSON.stringify(meta), 'EX', AGGREGATION_WINDOW_SECONDS + 10);
            }
        }
        // Set TTL on sorted set
        await redis_1.default.expire(redisKey, AGGREGATION_WINDOW_SECONDS + 10);
        // Check batch size
        const currentCount = await redis_1.default.zcard(redisKey);
        // Send immediately for first 1-2 likes (instant feedback)
        if (currentCount <= 2) {
            console.log(`\n⚡ ════════════════════════════════════════════════`);
            console.log(`⚡ INSTANT DELIVERY: ${event.type} #${currentCount}`);
            console.log(`⚡ Reason: First ${currentCount} event(s) - immediate feedback`);
            console.log(`⚡ Target User: ${event.targetId}`);
            console.log(`⚡ Actor: ${event.actorName || event.actorId}`);
            console.log(`⚡ ════════════════════════════════════════════════\n`);
            return { shouldSendNow: true };
        }
        // For 3+ events: ALWAYS batch and wait for window expiry
        // Calculate wait time until window expires
        const windowStartTime = windowId * AGGREGATION_WINDOW_SECONDS * 1000;
        const windowEndTime = windowStartTime + (AGGREGATION_WINDOW_SECONDS * 1000);
        const waitTimeMs = windowEndTime - Date.now();
        const waitTimeSec = Math.ceil(waitTimeMs / 1000);
        console.log(`\n⏳ ════════════════════════════════════════════════`);
        console.log(`⏳ QUEUED IN AGGREGATION WINDOW`);
        console.log(`⏳ Type: ${event.type}`);
        console.log(`⏳ Window ID: ${windowId}`);
        console.log(`⏳ Current Count: ${currentCount} events batched`);
        console.log(`⏳ Wait Time: ~${waitTimeSec}s until window flush`);
        console.log(`⏳ Target User: ${event.targetId}`);
        console.log(`⏳ Message: Will show "${event.actorName} and ${currentCount - 1} others..."`);
        console.log(`⏳ ════════════════════════════════════════════════\n`);
        // Wait for window to close - aggregated notification sent by flush job
        return { shouldSendNow: false };
    }
    catch (error) {
        console.error('❌ Aggregation error:', error);
        // Fallback: send immediately
        return { shouldSendNow: true };
    }
}
/**
 * Flush aggregation window and return aggregated data
 */
async function flushAggregationWindow(redisKey, metaKey) {
    try {
        const eventsKey = `${redisKey}:events`;
        // Get all actors (with scores)
        const actors = await redis_1.default.zrange(redisKey, 0, -1);
        const meta = JSON.parse((await redis_1.default.get(metaKey)) || '{}');
        // Get all stored events for batch DB writes
        const eventStrings = await redis_1.default.lrange(eventsKey, 0, -1);
        const allEvents = eventStrings.map(str => JSON.parse(str));
        if (!actors.length || !meta.firstEvent) {
            return undefined;
        }
        const aggregated = {
            actors,
            actorNames: meta.actorNames || [],
            actorAvatars: meta.actorAvatars || [],
            firstEvent: meta.firstEvent,
            lastTimestamp: new Date().toISOString(),
            count: actors.length,
            allEvents, // Include all events for batch processing
        };
        // Delete keys (consumed)
        await redis_1.default.del(redisKey, metaKey, eventsKey);
        return aggregated;
    }
    catch (error) {
        console.error('❌ Flush error:', error);
        return undefined;
    }
}
/**
 * Background job to flush expired windows
 * Call this every minute from processing service
 * @param sendCallback - Function to send the aggregated notification
 */
async function flushExpiredWindows(sendCallback) {
    const flushedWindows = [];
    try {
        const currentWindowId = getCurrentWindowId();
        const previousWindowId = currentWindowId - 1;
        // Scan for keys from previous window
        const pattern = `agg:*:${previousWindowId}`;
        const keys = await scanKeys(pattern);
        console.log(`🔄 Flushing expired aggregation windows...`);
        console.log(`   - currentWindowId=${currentWindowId}, previousWindowId=${previousWindowId}`);
        console.log(`   - pattern=${pattern}`);
        console.log(`   - matchedKeys=${keys.length}`);
        if (keys.length === 0) {
            const currentPattern = `agg:*:${currentWindowId}`;
            const currentKeys = await scanKeys(currentPattern);
            console.log(`ℹ️  No expired windows found. Current-window keys: ${currentKeys.length} (pattern=${currentPattern})`);
        }
        for (const key of keys) {
            if (!key.endsWith(':meta')) {
                const metaKey = `${key}:meta`;
                const aggregated = await flushAggregationWindow(key, metaKey);
                if (aggregated && aggregated.count > 0) {
                    console.log(`\n📬 ════════════════════════════════════════════════`);
                    console.log(`📬 WINDOW EXPIRED - SENDING AGGREGATED NOTIFICATION`);
                    console.log(`📬 Type: ${aggregated.firstEvent.type}`);
                    console.log(`📬 Count: ${aggregated.count} events`);
                    console.log(`📬 Actors: ${aggregated.actorNames.slice(0, 3).join(', ')}${aggregated.count > 3 ? '...' : ''}`);
                    console.log(`📬 Target: ${aggregated.firstEvent.targetId}`);
                    console.log(`📬 ════════════════════════════════════════════════\n`);
                    flushedWindows.push(aggregated);
                    // Call the send callback if provided
                    if (sendCallback) {
                        await sendCallback(aggregated);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('❌ Error flushing expired windows:', error);
    }
    return flushedWindows;
}
/**
 * Scan Redis keys with pattern (uses SCAN to avoid blocking)
 */
async function scanKeys(pattern) {
    const keys = [];
    let cursor = '0';
    do {
        const [newCursor, batch] = await redis_1.default.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        keys.push(...batch);
    } while (cursor !== '0');
    return keys;
}
/**
 * Check if notification should be sent based on rate limiting
 * (Legacy function - kept for backward compatibility)
 */
async function shouldSendNotification(userId, type) {
    const key = `rate_limit:${userId}:${type}`;
    try {
        const exists = await redis_1.default.exists(key);
        if (exists) {
            console.log(`⏸️  Rate Limited: ${type} for ${userId}`);
            return false;
        }
        // Set rate limit flag
        await redis_1.default.set(key, '1', 'EX', 60);
        return true;
    }
    catch (error) {
        console.error('❌ Rate limit check error:', error);
        return true; // Fail open
    }
}
/**
 * Generate human-readable aggregated message
 */
function generateAggregatedMessage(type, actorNames, count) {
    const firstName = actorNames[0];
    const othersCount = count - 1;
    const templates = {
        LIKE: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} liked your post`
            : `${name} liked your post`,
        COMMENT: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} commented on your post`
            : `${name} commented on your post`,
        COMMENT_REPLY: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} replied to your comment`
            : `${name} replied to your comment`,
        FOLLOW: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} started following you`
            : `${name} started following you`,
        POST_SHARE: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} shared your post`
            : `${name} shared your post`,
        STORY_VIEW: (name, others) => others > 0
            ? `${name} and ${others} other${others > 1 ? 's' : ''} viewed your story`
            : `${name} viewed your story`,
        BELL_POST: (name) => `${name} posted a new update`,
        MENTION: (name) => `${name} mentioned you`,
        OTP: () => 'Your OTP code',
        PASSWORD_RESET: () => 'Password reset request',
        SECURITY_ALERT: () => 'Security alert',
        MARKETING: () => 'Marketing notification',
        DIGEST: () => 'Daily digest',
    };
    const template = templates[type];
    return template ? template(firstName, othersCount) : `${firstName} interacted with your content`;
}
