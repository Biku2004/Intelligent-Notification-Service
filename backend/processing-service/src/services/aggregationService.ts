// Smart Aggregation Service with Redis-based Batching
// Implements: "John and 5 others liked your post" logic
import { redis } from '../config/redis';
import { NotificationEvent, NotificationType } from '../../../shared/types';

const AGGREGATION_WINDOW_SECONDS = 120; // 2 minutes
const MAX_BATCH_SIZE = 50;

interface AggregationKey {
  userId: string;
  type: NotificationType;
  targetEntityId?: string;
}

interface AggregatedData {
  actors: string[];
  actorNames: string[];
  actorAvatars: string[];
  firstEvent: NotificationEvent;
  lastTimestamp: string;
  count: number;
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

  try {
    // Add actor to sorted set (score = timestamp)
    const timestamp = new Date(event.timestamp).getTime();
    await redis.zadd(redisKey, timestamp, event.actorId);

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

    // Flush if max batch size reached
    if (currentCount >= MAX_BATCH_SIZE) {
      const aggregated = await flushAggregationWindow(redisKey, metaKey);
      return { shouldSendNow: true, aggregatedData: aggregated };
    }

    // Otherwise, wait for window to close
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
    // Get all actors (with scores)
    const actors = await redis.zrange(redisKey, 0, -1);
    const meta = JSON.parse((await redis.get(metaKey)) || '{}');

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
    };

    // Delete keys (consumed)
    await redis.del(redisKey, metaKey);

    return aggregated;
  } catch (error) {
    console.error('❌ Flush error:', error);
    return undefined;
  }
}

/**
 * Background job to flush expired windows
 * Call this every minute from processing service
 */
export async function flushExpiredWindows(): Promise<void> {
  try {
    const currentWindowId = getCurrentWindowId();
    const previousWindowId = currentWindowId - 1;

    // Scan for keys from previous window
    const pattern = `agg:*:${previousWindowId}`;
    const keys = await scanKeys(pattern);

    console.log(`🔄 Flushing ${keys.length} expired aggregation windows...`);

    for (const key of keys) {
      if (!key.endsWith(':meta')) {
        const metaKey = `${key}:meta`;
        const aggregated = await flushAggregationWindow(key, metaKey);

        if (aggregated) {
          // Send aggregated notification (to be implemented in consumer)
          console.log(
            `✅ Flushed aggregation: ${aggregated.count} actors for ${aggregated.firstEvent.type}`
          );
          // TODO: Produce aggregated notification to Kafka
        }
      }
    }
  } catch (error) {
    console.error('❌ Error flushing expired windows:', error);
  }
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
  };

  const template = templates[type];
  return template ? template(firstName, othersCount) : `${firstName} interacted with your content`;
}
