import { producer } from '../config/kafka';
import { 
  NotificationEvent, 
  NotificationPriority, 
  NotificationType,
  getPriorityForType,
  getTopicForPriority 
} from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

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

export const sendToKafka = async (event: EventPayload) => {
  try {
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

    console.log(`📤 [${priority}] Event sent to ${topic}: ${event.type} for ${event.targetId}`);
    return { success: true, eventId: notificationEvent.id, topic, priority };
  } catch (error) {
    console.error('❌ Kafka Producer Error:', error);
    throw new Error('Failed to send event to Kafka');
  }
};