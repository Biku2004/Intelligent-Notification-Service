import dotenv from 'dotenv';
import { connectKafka, consumer, producer } from './config/kafka';
import { shouldSendNotification } from './services/aggregationService';
import { logNotification } from './services/dynamoService';
import { checkUserPreferences } from './services/preferenceService'; // <--- IMPORT THIS

dotenv.config();

const startService = async () => {
  console.log('🧠 Processing Service Starting...');

  await connectKafka();

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const rawValue = message.value?.toString();
      if (!rawValue) return;

      const event = JSON.parse(rawValue);
      console.log(`📥 Received Event: ${event.type} for ${event.targetId}`);

      // 1. Aggregation Check (Redis)
      const isRateLimited = await shouldSendNotification(event.targetId, event.type);
      if (!isRateLimited) {
        await logNotification(event, 'SUPPRESSED');
        return;
      }

      // 2. Preference Check (Postgres) <--- NEW LOGIC
      const isPreferred = await checkUserPreferences(event.targetId, event.type);
      if (!isPreferred) {
        // We log it as "FILTERED" so we know why it wasn't sent
        await logNotification(event, 'FILTERED_PREFS'); 
        return;
      }

      // 3. Send to Final Delivery Topic
      await producer.send({
        topic: 'ready-notifications',
        messages: [{ value: JSON.stringify(event) }],
      });

      console.log(`✅ Approved & Forwarded: ${event.type}`);
      await logNotification(event, 'SENT');
    },
  });
};

startService();