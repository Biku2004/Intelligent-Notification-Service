/**
 * Dead Letter Queue (DLQ) Service for SMS Delivery
 * Handles failed SMS notifications
 */

import { Kafka, Producer } from 'kafkajs';
import { NotificationEvent } from '../../../shared/types';

let dlqProducer: Producer | null = null;
const DLQ_TOPIC = 'failed-notifications-dlq';

/**
 * Initialize DLQ producer
 */
export async function initDLQProducer(kafka: Kafka): Promise<void> {
  if (!dlqProducer) {
    dlqProducer = kafka.producer();
    await dlqProducer.connect();
    console.log('✅ DLQ producer connected');
  }
}

/**
 * Send failed SMS notification to Dead Letter Queue
 */
export async function sendToDLQ(
  event: NotificationEvent,
  errorMessage: string,
  attemptCount: number,
  kafka: Kafka
): Promise<void> {
  try {
    if (!dlqProducer) {
      await initDLQProducer(kafka);
    }

    const dlqMessage = {
      ...event,
      dlqMetadata: {
        failedChannel: 'SMS',
        errorMessage,
        attemptCount,
        failedAt: new Date().toISOString(),
        originalTimestamp: event.timestamp,
      },
    };

    await dlqProducer!.send({
      topic: DLQ_TOPIC,
      messages: [{
        key: event.targetId,
        value: JSON.stringify(dlqMessage),
        headers: {
          channel: Buffer.from('SMS'),
          priority: Buffer.from(event.priority),
          type: Buffer.from(event.type),
        },
      }],
    });

    console.log(`📮 Sent to DLQ: SMS notification for ${event.targetId}`);
  } catch (error) {
    console.error('❌ Failed to send to DLQ:', error);
  }
}

/**
 * Ensure DLQ topic exists
 */
export async function ensureDLQTopicExists(kafka: Kafka): Promise<void> {
  const admin = kafka.admin();
  
  try {
    await admin.connect();
    
    const existingTopics = await admin.listTopics();
    
    if (!existingTopics.includes(DLQ_TOPIC)) {
      await admin.createTopics({
        topics: [{
          topic: DLQ_TOPIC,
          numPartitions: 3,
          replicationFactor: 1,
          configEntries: [
            { name: 'retention.ms', value: '2592000000' }, // 30 days
            { name: 'cleanup.policy', value: 'delete' },
          ],
        }],
      });
      console.log(`✅ Created DLQ topic: ${DLQ_TOPIC}`);
    }
  } catch (error) {
    console.error('❌ Error ensuring DLQ topic:', error);
  } finally {
    await admin.disconnect();
  }
}
