import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { 
  startKafkaConsumer, 
  userConnected, 
  userDisconnected,
  getConnectedUserCount 
} from './services/kafkaConsumer';

dotenv.config();

const app = express();
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'socket-service',
    connectedUsers: getConnectedUserCount(),
    uptime: process.uptime(),
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  // User joins their own room (e.g., "user_123")
  socket.on('join_room', (userId: string) => {
    socket.join(userId);
    userConnected(userId, socket.id);
    
    // Send acknowledgment
    socket.emit('joined', { userId, socketId: socket.id });
    console.log(`✅ User ${socket.id} joined room: ${userId}`);
  });

  // Handle user leaving a room
  socket.on('leave_room', (userId: string) => {
    socket.leave(userId);
    userDisconnected(userId, socket.id);
    console.log(`👋 User ${socket.id} left room: ${userId}`);
  });

  // Handle explicit notification acknowledgment
  socket.on('notification_ack', (data: { notificationId: string }) => {
    console.log(`✓ Notification ${data.notificationId} acknowledged by ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    // Clean up user tracking (iterate through rooms)
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      if (room !== socket.id) {
        userDisconnected(room, socket.id);
      }
    });
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Start Kafka Consumer and pass the IO instance
startKafkaConsumer(io).catch(console.error);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket Service running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  server.close(() => {
    console.log('✅ Socket service shut down');
    process.exit(0);
  });
});
