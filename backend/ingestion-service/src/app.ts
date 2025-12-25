import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'Ingestion Service' });
});

app.listen(PORT, () => {
  console.log(`🚀 Ingestion Service running on port ${PORT}`);
});