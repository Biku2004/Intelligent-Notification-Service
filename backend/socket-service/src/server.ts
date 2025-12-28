import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import cors from 'cors';
import { startKafkaConsumer } from './services/kafkaConsumer';

dotenv.config();

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow React Frontend
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User joins their own room (e.g., "user_123")
  socket.on('join_room', (userId) => {
    socket.join(userId);
    console.log(`User ${socket.id} joined room: ${userId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start Kafka Consumer and pass the IO instance
startKafkaConsumer(io).catch(console.error);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Socket Service running on port ${PORT}`);
});