// Smart Aggregation Service with Redis-based Batching
// Implements: "John and 5 others liked your post" logic
// Enhanced with follower-based priority delivery
import redis from '../config/redis';
import { NotificationEvent, NotificationType } from '../../../shared/types';

// Configuration for aggregation windows
const AGGREGATION_WINDOW_SECONDS = 120; // 2 minutes for clear batching demonstration
const INSTANT_LIKE_THRESHOLD = 3; // 1-3 likes = instant delivery
const FOLLOWER_BATCH_THRESHOLD = 4; // 4+ from followers = batch
const MAX_BATCH_SIZE = 50;

interface AggregationKey {
  userId: string;
  type: NotificationType;
  targetEntityId?: string;
}

export interface AggregatedData {
  actors: string[];
  actorNames: string[];
  actorAvatars: string[];
  firstEvent: NotificationEvent;
  lastTimestamp: string;
  count: number;
  allEvents: NotificationEvent[]; // Store all events for batch DB writes
}

/**
 * Determines if notification type should be aggregated
 */
export function shouldAggregate(type: NotificationType): boolean {
  const aggregatableTypes: NotificationType[] = [
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
function getAggregationKey(key: AggregationKey, windowId: number): string {
  const { userId, type, targetEntityId } = key;
  const entityPart = targetEntityId ? `:${targetEntityId}` : '';
  return `agg:${userId}:${type}${entityPart}:${windowId}`;
}

/**
 * Get current aggregation window ID (changes every 2 minutes)
 */
function getCurrentWindowId(): number {
  return Math.floor(Date.now() / (AGGREGATION_WINDOW_SECONDS * 1000));
}

/**
 * Add event to aggregation window
 * Returns: { shouldSendNow: boolean, aggregatedData?: AggregatedData }
 */
export async function addToAggregationWindow(
  event: NotificationEvent
): Promise<{ shouldSendNow: boolean; aggregatedData?: AggregatedData }> {
  if (!shouldAggregate(event.type)) {
    return { shouldSendNow: true };
  }

  const windowId = getCurrentWindowId();
  const key: AggregationKey = {
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
    await redis.zadd(redisKey, timestamp, event.actorId);

    // Store all events for batch DB writes
    await redis.rpush(eventsKey, JSON.stringify(event));
    await redis.expire(eventsKey, AGGREGATION_WINDOW_SECONDS + 10);

    // Store metadata about first event
    const exists = await redis.exists(metaKey);
    if (!exists) {
      await redis.set(
        metaKey,
        JSON.stringify({
          firstEvent: event,
          actorNames: [event.actorName || event.actorId],
          actorAvatars: [event.actorAvatar || ''],
        }),
        'EX',
        AGGREGATION_WINDOW_SECONDS + 10 // Extra buffer
      );
    } else {
      // Update actor metadata
      const meta = JSON.parse((await redis.get(metaKey)) || '{}');
      if (event.actorName && !meta.actorNames.includes(event.actorName)) {
        meta.actorNames.push(event.actorName);
        meta.actorAvatars.push(event.actorAvatar || '');
        await redis.set(metaKey, JSON.stringify(meta), 'EX', AGGREGATION_WINDOW_SECONDS + 10);
      }
    }

    // Set TTL on sorted set
    await redis.expire(redisKey, AGGREGATION_WINDOW_SECONDS + 10);

    // Check batch size
    const currentCount = await redis.zcard(redisKey);

    // Extract follower info from metadata
    const isFromFollower = event.metadata?.isFromFollowedUser === true;
    const isTestUser = event.metadata?.isTestUser === true;

    // COMMENT and COMMENT_REPLY: ALWAYS batch and wait for window expiry
    // This ensures all comments are collected before notification + DB write
    const alwaysBatchTypes: NotificationType[] = ['COMMENT', 'COMMENT_REPLY'];

    if (alwaysBatchTypes.includes(event.type)) {
      // Calculate wait time until window expires
      const windowStartTime = windowId * AGGREGATION_WINDOW_SECONDS * 1000;
      const windowEndTime = windowStartTime + (AGGREGATION_WINDOW_SECONDS * 1000);
      const waitTimeMs = windowEndTime - Date.now();
      const waitTimeSec = Math.ceil(waitTimeMs / 1000);

      console.log(`\n⏳ ════════════════════════════════════════════════`);
      console.log(`⏳ QUEUED IN AGGREGATION WINDOW (ALWAYS BATCH)`);
      console.log(`⏳ Type: ${event.type}`);
      console.log(`⏳ Window ID: ${windowId}`);
      console.log(`⏳ Current Count: ${currentCount} events batched`);
      console.log(`⏳ Wait Time: ~${waitTimeSec}s until window flush`);
      console.log(`⏳ Target User: ${event.targetId}`);
      console.log(`⏳ Reason: Comments always wait for batch DB write + notification`);
      console.log(`⏳ Message: Will show "${event.actorName}${currentCount > 1 ? ` and ${currentCount - 1} others` : ''}..."`);
      console.log(`⏳ ════════════════════════════════════════════════\n`);

      return { shouldSendNow: false };
    }

    // SMART NOTIFICATION LOGIC:
    // 1-3 likes from ANY user = INSTANT notification to post creator
    // This gives immediate feedback that someone liked the post
    if (currentCount <= INSTANT_LIKE_THRESHOLD) {
      console.log(`\n⚡ ════════════════════════════════════════════════`);
      console.log(`⚡ INSTANT DELIVERY: ${event.type} #${currentCount}`);
      console.log(`⚡ Reason: 1-${INSTANT_LIKE_THRESHOLD} likes = immediate feedback`);
      console.log(`⚡ Target User: ${event.targetId}`);
      console.log(`⚡ Actor: ${event.actorName || event.actorId}`);
      console.log(`⚡ Is Follower: ${isFromFollower ? 'Yes' : 'No'}`);
      console.log(`⚡ ════════════════════════════════════════════════\n`);
      return { shouldSendNow: true };
    }

    // For 4+ likes, use follower-based batching logic:
    // - Followers: Batch but with priority (show in notification)
    // - Non-followers: Batch and wait for full window
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
    console.log(`⏳ Is Follower: ${isFromFollower ? 'Yes (higher priority in notification)' : 'No'}`);
    console.log(`⏳ Message: Will show "${event.actorName} and ${currentCount - 1} others..."`);
    console.log(`⏳ ════════════════════════════════════════════════\n`);

    // Wait for window to close - aggregated notification sent by flush job
    return { shouldSendNow: false };
  } catch (error) {
    console.error('❌ Aggregation error:', error);
    // Fallback: send immediately
    return { shouldSendNow: true };
  }
}

/**
 * Flush aggregation window and return aggregated data
 */
async function flushAggregationWindow(
  redisKey: string,
  metaKey: string
): Promise<AggregatedData | undefined> {
  try {
    const eventsKey = `${redisKey}:events`;

    // Get all actors (with scores)
    const actors = await redis.zrange(redisKey, 0, -1);
    const meta = JSON.parse((await redis.get(metaKey)) || '{}');

    // Get all stored events for batch DB writes
    const eventStrings = await redis.lrange(eventsKey, 0, -1);
    const allEvents = eventStrings.map(str => JSON.parse(str));

    if (!actors.length || !meta.firstEvent) {
      return undefined;
    }

    const aggregated: AggregatedData = {
      actors,
      actorNames: meta.actorNames || [],
      actorAvatars: meta.actorAvatars || [],
      firstEvent: meta.firstEvent,
      lastTimestamp: new Date().toISOString(),
      count: actors.length,
      allEvents, // Include all events for batch processing
    };

    // Delete keys (consumed)
    await redis.del(redisKey, metaKey, eventsKey);

    return aggregated;
  } catch (error) {
    console.error('❌ Flush error:', error);
    return undefined;
  }
}

/**
 * Background job to flush expired windows
 * Call this every minute from processing service
 * @param sendCallback - Function to send the aggregated notification
 */
export async function flushExpiredWindows(
  sendCallback?: (aggregatedData: AggregatedData) => Promise<void>
): Promise<AggregatedData[]> {
  const flushedWindows: AggregatedData[] = [];

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
  } catch (error) {
    console.error('❌ Error flushing expired windows:', error);
  }

  return flushedWindows;
}

/**
 * Scan Redis keys with pattern (uses SCAN to avoid blocking)
 */
async function scanKeys(pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';

  do {
    const [newCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}

/**
 * Check if notification should be sent based on rate limiting
 * (Legacy function - kept for backward compatibility)
 */
export async function shouldSendNotification(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const key = `rate_limit:${userId}:${type}`;

  try {
    const exists = await redis.exists(key);

    if (exists) {
      console.log(`⏸️  Rate Limited: ${type} for ${userId}`);
      return false;
    }

    // Set rate limit flag
    await redis.set(key, '1', 'EX', 60);
    return true;
  } catch (error) {
    console.error('❌ Rate limit check error:', error);
    return true; // Fail open
  }
}

/**
 * Generate human-readable aggregated message
 */
export function generateAggregatedMessage(
  type: NotificationType,
  actorNames: string[],
  count: number
): string {
  const firstName = actorNames[0];
  const othersCount = count - 1;

  const templates: Record<NotificationType, (name: string, others: number) => string> = {
    LIKE: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} liked your post`
        : `${name} liked your post`,
    COMMENT: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} commented on your post`
        : `${name} commented on your post`,
    COMMENT_REPLY: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} replied to your comment`
        : `${name} replied to your comment`,
    FOLLOW: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} started following you`
        : `${name} started following you`,
    POST_SHARE: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} shared your post`
        : `${name} shared your post`,
    STORY_VIEW: (name, others) =>
      others > 0
        ? `${name} and ${others} other${others > 1 ? 's' : ''} viewed your story`
        : `${name} viewed your story`,
    BELL_POST: (name) => `${name} posted a new update`,
    MENTION: (name) => `${name} mentioned you`,
    OTP: () => 'Your OTP code',
    PASSWORD_RESET: () => 'Password reset request',
    SECURITY_ALERT: () => 'Security alert',
    MARKETING: () => 'Marketing notification',
    DIGEST: () => 'Daily digest',
    POST_UPDATED: () => 'Post updated', // Internal event, rarely displayed directly
  };

  const template = templates[type];
  return template ? template(firstName, othersCount) : `${firstName} interacted with your content`;
}
