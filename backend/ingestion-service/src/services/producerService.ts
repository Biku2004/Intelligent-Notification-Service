import { producer } from '../config/kafka';

interface EventPayload {
  type: 'LIKE' | 'COMMENT' | 'FOLLOW';
  actorId: string;    // Who performed the action (User A)
  targetId: string;   // Who receives the notification (User B)
  metadata: any;      // Extra data (postId, commentText, etc.)
}

export const sendToKafka = async (event: EventPayload) => {
  try {
    await producer.send({
      topic: 'raw-events',
      messages: [
        {
          key: event.actorId, // Key ensures ordering for the same user
          value: JSON.stringify({
            ...event,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });
    console.log(`📤 Event Sent to Kafka: ${event.type}`);
  } catch (error) {
    console.error('Error sending message to Kafka:', error);
    throw new Error('Kafka Producer Error');
  }
};