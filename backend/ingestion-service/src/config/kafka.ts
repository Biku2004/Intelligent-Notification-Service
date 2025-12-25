import { Kafka, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'ingestion-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR, // Reduce noise in console
});

export const producer = kafka.producer();

export const connectKafka = async () => {
  try {
    await producer.connect();
    console.log('✅ Kafka Producer Connected');
  } catch (error) {
    console.error('❌ Kafka Connection Error:', error);
    process.exit(1);
  }
};