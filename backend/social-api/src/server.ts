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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  console.log(`✅ Social API running on http://localhost:${PORT}`);
});
