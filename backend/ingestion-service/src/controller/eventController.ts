import { Request, Response } from 'express';
import { sendToKafka } from '../services/producerService';

export const triggerEvent = async (req: Request, res: Response) => {
  const { type, actorId, targetId, metadata } = req.body;

  // Basic Validation
  if (!type || !actorId || !targetId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Send to Kafka
    await sendToKafka({ type, actorId, targetId, metadata });

    res.status(202).json({ 
      status: 'accepted', 
      message: 'Event processing started' 
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};