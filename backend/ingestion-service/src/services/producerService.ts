/**
 * Producer Service with Kafka Fallback
 * Sends notification events to Kafka, falls back to PostgreSQL when Kafka is unavailable
 * 
 * RELIABILITY: P1 Fix #1 - Kafka fallback to database
 */
import { producer } from '../config/kafka';
import {
  NotificationEvent,
  NotificationPriority,
  NotificationType,
  getPriorityForType,
  getTopicForPriority
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';
import { storeInFallback } from './fallbackService';

interface EventPayload {
  type: NotificationType;
  actorId: string;
  targetId: string;
  actorName?: string;
  actorAvatar?: string;
  targetType?: 'POST' | 'COMMENT' | 'USER' | 'STORY';
  targetEntityId?: string;
  title?: string;
  message?: string;
  imageUrl?: string;
  priority?: NotificationPriority;  // Optional override
  metadata?: Record<string, any>;
}

// Track Kafka health status
let kafkaHealthy = true;
let lastKafkaError: Date | null = null;

/**
 * Check if Kafka is likely available
 */
export const isKafkaHealthy = (): boolean => {
  // If we haven't had an error recently, assume healthy
  if (!lastKafkaError) return true;

  // After 30 seconds, try Kafka again
  const timeSinceError = Date.now() - lastKafkaError.getTime();
  return timeSinceError > 30000;
};

/**
 * Send event to Kafka with automatic fallback to PostgreSQL
 */
export const sendToKafka = async (event: EventPayload): Promise<{
  success: boolean;
  eventId: string;
  topic: string;
  priority: string;
  usedFallback?: boolean;
}> => {
  // Determine priority (can be overridden for special cases)
  const priority = event.priority || getPriorityForType(event.type);
  const topic = getTopicForPriority(priority);

  // Build complete notification event
  const notificationEvent: NotificationEvent = {
    id: uuidv4(),
    type: event.type,
    priority,
    actorId: event.actorId,
    actorName: event.actorName,
    actorAvatar: event.actorAvatar,
    targetId: event.targetId,
    targetType: event.targetType,
    targetEntityId: event.targetEntityId,
    title: event.title,
    message: event.message,
    imageUrl: event.imageUrl,
    timestamp: new Date().toISOString(),
    metadata: event.metadata,
  };

  // Try Kafka first if it seems healthy
  if (isKafkaHealthy()) {
    try {
      await producer.send({
        topic,
        messages: [
          {
            key: event.targetId, // Partition by target user for ordering
            value: JSON.stringify(notificationEvent),
            headers: {
              priority: Buffer.from(priority),
              type: Buffer.from(event.type),
              timestamp: Buffer.from(notificationEvent.timestamp),
            },
          },
        ],
      });

      // Reset health status on success
      kafkaHealthy = true;
      lastKafkaError = null;

      console.log(`📤 [${priority}] Event sent to ${topic}: ${event.type} for ${event.targetId}`);
      return {
        success: true,
        eventId: notificationEvent.id,
        topic,
        priority,
        usedFallback: false
      };
    } catch (error: any) {
      console.error('❌ Kafka Producer Error:', error.message);
      kafkaHealthy = false;
      lastKafkaError = new Date();

      // Fall through to fallback
    }
  }

  // Fallback to PostgreSQL
  console.log(`⚠️ Kafka unavailable, using database fallback for event ${notificationEvent.id}`);

  const fallbackSuccess = await storeInFallback(
    notificationEvent,
    topic,
    lastKafkaError ? 'Kafka connection error' : 'Unknown error'
  );

  if (fallbackSuccess) {
    return {
      success: true,
      eventId: notificationEvent.id,
      topic,
      priority,
      usedFallback: true
    };
  }

  throw new Error('Failed to send event: both Kafka and database fallback failed');
};

/**
 * Get current Kafka health status
 */
export const getKafkaStatus = () => ({
  healthy: kafkaHealthy,
  lastError: lastKafkaError,
  usingFallback: !kafkaHealthy
});