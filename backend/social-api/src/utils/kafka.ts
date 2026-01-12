import { Kafka, Producer } from 'kafkajs';

// Kafka Topics by Priority
const KAFKA_TOPICS = {
  CRITICAL: 'critical-notifications',
  HIGH: 'high-priority-notifications',
  LOW: 'low-priority-notifications',
  READY: 'ready-notifications',
} as const;

type NotificationPriority = 'CRITICAL' | 'HIGH' | 'LOW';

const kafka = new Kafka({
  clientId: 'social-api',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

let producer: Producer | null = null;

/**
 * Initialize Kafka producer
 */
export const initKafkaProducer = async (): Promise<Producer> => {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    console.log('✅ Kafka producer connected');
  }
  return producer;
};

/**
 * Get the correct Kafka topic based on priority
 */
function getTopicForPriority(priority: NotificationPriority): string {
  switch (priority) {
    case 'CRITICAL':
      return KAFKA_TOPICS.CRITICAL;
    case 'HIGH':
      return KAFKA_TOPICS.HIGH;
    case 'LOW':
      return KAFKA_TOPICS.LOW;
    default:
      return KAFKA_TOPICS.HIGH;
  }
}

/**
 * Send notification event to Kafka with proper priority routing
 */
export const sendNotificationEvent = async (event: any): Promise<void> => {
  try {
    const kafkaProducer = await initKafkaProducer();
    
    // Route to the correct priority-based topic
    const priority: NotificationPriority = event.priority || 'HIGH';
    const topic = getTopicForPriority(priority);
    
    await kafkaProducer.send({
      topic,
      messages: [
        {
          key: event.targetId, // Partition by target user for ordering
          value: JSON.stringify(event),
          headers: {
            priority: Buffer.from(priority),
            type: Buffer.from(event.type),
            timestamp: Buffer.from(event.timestamp || new Date().toISOString()),
          },
        },
      ],
    });
    
    console.log(`📤 [${priority}] Event sent to ${topic}: ${event.type} for ${event.targetId}`);
  } catch (error) {
    console.error('❌ Failed to send notification event:', error);
  }
};
