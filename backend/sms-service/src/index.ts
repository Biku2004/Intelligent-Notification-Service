import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { NotificationEvent, KAFKA_TOPICS } from '../../shared/types';
import { sendSMS, getUserPhone } from './services/smsService';
import { retryIfRetryable, isRetryableError } from '../../shared/retryHandler';
import { sendToDLQ, ensureDLQTopicExists } from './services/dlqService';

dotenv.config();

const kafka = new Kafka({
  clientId: 'sms-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const consumer = kafka.consumer({ 
  groupId: process.env.KAFKA_GROUP_ID || 'sms-delivery-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

/**
 * Process notification event and send SMS with retry logic
 */
async function processSMSDelivery(event: NotificationEvent): Promise<void> {
  console.log(`📱 Processing SMS for: ${event.type} to ${event.targetId}`);

  let attemptCount = 0;

  try {
    // Only send SMS for critical notifications
    if (event.priority !== 'CRITICAL') {
      console.log(`⏭️  Skipping SMS for non-critical event: ${event.type}`);
      return;
    }

    // Get user's phone number
    const userPhone = await getUserPhone(event.targetId);
    
    if (!userPhone) {
      console.log(`⚠️  No phone number found for user ${event.targetId}`);
      return;
    }

    // Check if user wants SMS notifications (from metadata)
    const smsEnabled = event.metadata?.channels?.includes('SMS');
    if (smsEnabled === false) {
      console.log(`🔕 SMS disabled for user ${event.targetId}`);
      return;
    }

    // Send SMS with retry logic
    await retryIfRetryable(
      async () => {
        attemptCount++;
        const result = await sendSMS(event, userPhone);
        
        if (!result.success) {
          throw new Error(result.error || 'SMS send failed');
        }
        
        return result;
      },
      `SMS delivery to ${userPhone}`,
      {
        maxRetries: 3,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 3,
      }
    );

    console.log(`✅ SMS delivered successfully`);
  } catch (error: any) {
    console.error(`❌ SMS failed after retries: ${error.message}`);
    
    // Send to DLQ if retryable error exhausted retries
    if (isRetryableError(error)) {
      await sendToDLQ(event, error.message, attemptCount, kafka);
    }
  }
}

/**
 * Start SMS delivery service
 */
async function startService() {
  console.log('📱 SMS Delivery Service Starting...');

  try {
    // Ensure DLQ topic exists
    await ensureDLQTopicExists(kafka);
    
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
        await processSMSDelivery(event);
      },
    });

    console.log('✅ SMS service ready and listening to ready-notifications');
    console.log('📬 Consuming from:', KAFKA_TOPICS.READY);
    console.log('⚠️  Only CRITICAL priority events will trigger SMS');
    console.log('🔄 Retry enabled with exponential backoff');
  } catch (error) {
    console.error('❌ Failed to start SMS service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  await consumer.disconnect();
  process.exit(0);
});

startService();
