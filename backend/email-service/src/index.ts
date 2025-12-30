import dotenv from 'dotenv';
import { Kafka, logLevel } from 'kafkajs';
import { NotificationEvent, KAFKA_TOPICS } from '../../shared/types';
import { sendEmail, getUserEmail } from './services/emailService';
import { retryIfRetryable, isRetryableError } from '../../shared/retryHandler';
import { sendToDLQ, ensureDLQTopicExists } from './services/dlqService';

dotenv.config();

const kafka = new Kafka({
  clientId: 'email-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  logLevel: logLevel.ERROR,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

const consumer = kafka.consumer({ 
  groupId: process.env.KAFKA_GROUP_ID || 'email-delivery-consumer',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

const producer = kafka.producer();

/**
 * Process notification event and send email with retry logic
 */
async function processEmailDelivery(event: NotificationEvent): Promise<void> {
  console.log(`📧 Processing email for: ${event.type} to ${event.targetId}`);

  let attemptCount = 0;

  try {
    // Get user's email address
    const userEmail = await getUserEmail(event.targetId);
    
    if (!userEmail) {
      console.log(`⚠️  No email found for user ${event.targetId}`);
      return;
    }

    // Check if user wants email notifications (from metadata)
    const emailEnabled = event.metadata?.channels?.includes('EMAIL');
    if (emailEnabled === false) {
      console.log(`🔕 Email disabled for user ${event.targetId}`);
      return;
    }

    // Send email with retry logic
    await retryIfRetryable(
      async () => {
        attemptCount++;
        const result = await sendEmail(event, userEmail);
        
        if (!result.success) {
          throw new Error(result.error || 'Email send failed');
        }
        
        return result;
      },
      `Email delivery to ${userEmail}`,
      {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
      }
    );

    console.log(`✅ Email delivered successfully`);
  } catch (error: any) {
    console.error(`❌ Email failed after retries: ${error.message}`);
    
    // Send to DLQ if retryable error exhausted retries
    if (isRetryableError(error)) {
      await sendToDLQ(event, error.message, attemptCount, kafka);
    }
  }
}

/**
 * Start email delivery service
 */
async function startService() {
  console.log('📧 Email Delivery Service Starting...');

  try {
    // Ensure DLQ topic exists
    await ensureDLQTopicExists(kafka);
    
    await consumer.connect();
    await producer.connect();
    
    await consumer.subscribe({ 
      topic: KAFKA_TOPICS.READY, 
      fromBeginning: false 
    });

    await consumer.run({
      eachMessage: async ({ message }) => {
        const rawValue = message.value?.toString();
        if (!rawValue) return;

        const event: NotificationEvent = JSON.parse(rawValue);
        await processEmailDelivery(event);
      },
    });

    console.log('✅ Email service ready and listening to ready-notifications');
    console.log('📬 Consuming from:', KAFKA_TOPICS.READY);
    console.log('🔄 Retry enabled with exponential backoff');
  } catch (error) {
    console.error('❌ Failed to start email service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down...');
  await consumer.disconnect();
  await producer.disconnect();
  process.exit(0);
});

startService();
