import { Kafka, logLevel } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'ingestion-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR, // Reduce noise in console
});

export const producer = kafka.producer();
 
export const connectKafka = async () => {
  const maxRetries = 10;
  let retries = 0;
 
  while (retries < maxRetries) {
    try {
      await producer.connect();
      console.log('✅ Kafka Producer Connected');
      return;
    } catch (error) {
      retries++;
      console.error(`❌ Kafka Connection Error (Attempt ${retries}/${maxRetries}):`, (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }
  }
 
  console.error('❌ Failed to connect to Kafka after multiple attempts');
  process.exit(1);
};