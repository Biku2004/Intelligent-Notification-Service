import './config/env'; // MUST BE FIRST
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
// import dotenv from 'dotenv'; // Handled in ./config/env
import path from 'path';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import {
  startKafkaConsumer,
  userConnected,
  userDisconnected,
  getConnectedUserCount
} from './services/kafkaConsumer';

// Load .env from project root (3 levels up: src -> socket-service -> backend -> root)
// dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') }); // Moved to ./config/env

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

  // SECURITY: C4 Fix - Authenticate join_room with JWT token
  socket.on('join_room', (data: { userId: string; token: string } | string) => {
    // Support both old format (just userId string) and new format (object with token)
    let userId: string;
    let token: string | undefined;

    if (typeof data === 'string') {
      // Legacy format — no auth (reject in production)
      userId = data;
      console.warn(`⚠️ join_room called without token for user ${userId}`);
      if (process.env.NODE_ENV === 'production') {
        socket.emit('error', { message: 'Authentication required' });
        return;
      }
    } else {
      userId = data.userId;
      token = data.token;
    }

    // Verify JWT token if provided
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          console.error('❌ JWT_SECRET not configured for socket service');
          socket.emit('error', { message: 'Server configuration error' });
          return;
        }
        const decoded = jwt.verify(token, jwtSecret) as { userId: string };
        if (decoded.userId !== userId) {
          console.warn(`🚫 Token userId mismatch: token=${decoded.userId}, requested=${userId}`);
          socket.emit('error', { message: 'User ID does not match token' });
          return;
        }
      } catch (err) {
        console.warn(`🚫 Invalid token for join_room: ${(err as Error).message}`);
        socket.emit('error', { message: 'Invalid or expired token' });
        return;
      }
    }

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
