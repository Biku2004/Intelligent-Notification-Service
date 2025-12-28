import { Kafka } from 'kafkajs';
import { Server } from 'socket.io';

const kafka = new Kafka({
  clientId: 'socket-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'socket-group' });

export const startKafkaConsumer = async (io: Server) => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'ready-notifications', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event = JSON.parse(rawValue);
      console.log(`🔥 Pushing to Frontend: ${event.type} -> ${event.targetId}`);

      // Emit to specific user room (we will handle room joining in server.ts)
      io.to(event.targetId).emit('notification', event);
    },
  });
};