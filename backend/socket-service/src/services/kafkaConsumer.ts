import { Kafka, logLevel } from 'kafkajs';
import { Server } from 'socket.io';
import { NotificationEvent, KAFKA_TOPICS } from '../../../shared/types';

const kafka = new Kafka({
  clientId: 'socket-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const consumer = kafka.consumer({ 
  groupId: 'socket-delivery-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

// Track connected users
const connectedUsers = new Map<string, Set<string>>(); // userId -> Set of socket IDs

export const startKafkaConsumer = async (io: Server) => {
  console.log('🔌 Starting Kafka consumer for WebSocket delivery...');
  
  await consumer.connect();
  await consumer.subscribe({ 
    topic: KAFKA_TOPICS.READY, 
    fromBeginning: false 
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event: NotificationEvent = JSON.parse(rawValue);
      console.log(`🔥 Pushing to Frontend: ${event.type} -> ${event.targetId}`);

      // Check if user wants push notifications
      const pushEnabled = event.metadata?.channels?.includes('PUSH') ?? true;
      if (!pushEnabled) {
        console.log(`🔕 Push disabled for user ${event.targetId}`);
        return;
      }

      // Emit to specific user room
      io.to(event.targetId).emit('notification', {
        id: event.id || Date.now().toString(),
        type: event.type,
        priority: event.priority,
        title: event.title || `New ${event.type.toLowerCase()}`,
        message: event.message,
        actorId: event.actorId,
        actorName: event.actorName,
        actorAvatar: event.actorAvatar,
        imageUrl: event.imageUrl,
        timestamp: event.timestamp || new Date().toISOString(),
        isRead: false,
        metadata: event.metadata,
      });

      console.log(`✅ Notification pushed to ${event.targetId}`);
    },
  });

  console.log('✅ Socket service ready and listening to ready-notifications');
};

// Helper to track user connections
export function userConnected(userId: string, socketId: string) {
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId)!.add(socketId);
  console.log(`👤 User ${userId} connected (${connectedUsers.get(userId)!.size} sessions)`);
}

export function userDisconnected(userId: string, socketId: string) {
  const userSockets = connectedUsers.get(userId);
  if (userSockets) {
    userSockets.delete(socketId);
    if (userSockets.size === 0) {
      connectedUsers.delete(userId);
      console.log(`👋 User ${userId} fully disconnected`);
    } else {
      console.log(`👤 User ${userId} session closed (${userSockets.size} remaining)`);
    }
  }
}

export function getConnectedUserCount(): number {
  return connectedUsers.size;
}
