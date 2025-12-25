// backend/processing-service/src/config/kafka.ts
import { Kafka, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'processing-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR,
});

export const consumer = kafka.consumer({ groupId: 'processing-group' });
export const producer = kafka.producer();

export const connectKafka = async () => {
  await consumer.connect();
  await producer.connect();
  // Subscribe to the raw events topic
  await consumer.subscribe({ topic: 'raw-events', fromBeginning: true });
  console.log('✅ Kafka Consumer & Producer Connected');
};