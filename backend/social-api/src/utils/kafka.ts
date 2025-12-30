import { Kafka, Producer } from 'kafkajs';

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
 * Send notification event to Kafka
 */
export const sendNotificationEvent = async (event: any): Promise<void> => {
  try {
    const kafkaProducer = await initKafkaProducer();
    
    await kafkaProducer.send({
      topic: 'raw-events',
      messages: [
        {
          key: event.id,
          value: JSON.stringify(event),
        },
      ],
    });
    
    console.log(`📤 Notification event sent: ${event.type} (${event.priority})`);
  } catch (error) {
    console.error('❌ Failed to send notification event:', error);
  }
};
