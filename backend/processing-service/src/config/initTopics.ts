import { Kafka, Admin } from 'kafkajs';

const TOPICS = [
  {
    topic: 'critical-notifications',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'high-priority-notifications',
    numPartitions: 5,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '172800000' }, // 2 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'low-priority-notifications',
    numPartitions: 2,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '604800000' }, // 7 days
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
  {
    topic: 'ready-notifications',
    numPartitions: 3,
    replicationFactor: 1,
    configEntries: [
      { name: 'retention.ms', value: '86400000' }, // 1 day
      { name: 'cleanup.policy', value: 'delete' },
    ],
  },
];

export async function ensureTopicsExist(kafka: Kafka): Promise<void> {
  const admin: Admin = kafka.admin();

  try {
    await admin.connect();
    console.log('🔗 Connected to Kafka admin');

    // Get existing topics
    const existingTopics = await admin.listTopics();
    console.log(`📋 Existing topics: ${existingTopics.join(', ')}`);

    // Filter topics that don't exist
    const topicsToCreate = TOPICS.filter(
      (t) => !existingTopics.includes(t.topic)
    );

    if (topicsToCreate.length === 0) {
      console.log('✅ All topics already exist');
      return;
    }

    // Create missing topics
    console.log(`🔧 Creating ${topicsToCreate.length} topics...`);
    await admin.createTopics({
      topics: topicsToCreate,
      waitForLeaders: true,
    });

    console.log(`✅ Topics created: ${topicsToCreate.map((t) => t.topic).join(', ')}`);
  } catch (error) {
    console.error('❌ Error initializing topics:', error);
    throw error;
  } finally {
    await admin.disconnect();
  }
}
