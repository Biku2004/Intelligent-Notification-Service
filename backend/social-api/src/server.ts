/**
 * Social API Server
 * Handles Users, Posts, Comments, Likes, and Follows
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes';
import { userRouter } from './routes/userRoutes';
import { postRouter } from './routes/postRoutes';
import { commentRouter } from './routes/commentRoutes';
import { followRouter } from './routes/followRoutes';
import { testRouter } from './routes/testRoutes';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

const app = express();
const PORT = process.env.SOCIAL_API_PORT || 3003;

import { tracingMiddleware } from '../../shared/middleware/tracing';
import { Logger } from '../../shared/utils/logger';

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(tracingMiddleware);

// Request logging
app.use((req, res, next) => {
  Logger.info(`Incoming ${req.method} request to ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'social-api',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/comments', commentRouter);
app.use('/api/follows', followRouter);
app.use('/api/test', testRouter); // Test routes for simulating bulk interactions

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  Logger.info(`✅ Social API running on http://localhost:${PORT}`);
});
