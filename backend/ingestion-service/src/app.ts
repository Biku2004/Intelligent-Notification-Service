import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectKafka } from './config/kafka';
import eventRoutes from './routes/eventRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS middleware - allow frontend to access
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// Middleware to parse JSON bodies
app.use(express.json());

app.use('/api/events', eventRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Ingestion Service' });
});

const startServer = async () => {
  // 1. Connect to Kafka First
  await connectKafka();

  // 2. Start Express
  app.listen(PORT, () => {
    console.log(`🚀 Ingestion Service running on port ${PORT}`);
  });
};
startServer();