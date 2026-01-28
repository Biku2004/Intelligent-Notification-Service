import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectKafka } from './config/kafka';
import eventRoutes from './routes/eventRoutes';

dotenv.config();

const app = express();
const PORT = process.env.INGESTION_PORT || 3000;

// Import tracing
import { tracingMiddleware } from '../../shared/middleware/tracing';
import { Logger } from '../../shared/utils/logger';

// CORS middleware - allow frontend to access
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(tracingMiddleware);

// Request logging
app.use((req, res, next) => {
  Logger.info(`Incoming ${req.method} request to ${req.url}`);
  next();
});

app.use('/api/events', eventRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Ingestion Service' });
});

const startServer = async () => {
  // 1. Connect to Kafka First
  await connectKafka();

  // 2. Start Express
  app.listen(PORT, () => {
    Logger.info(`🚀 Ingestion Service running on port ${PORT}`);
  });
};
startServer();