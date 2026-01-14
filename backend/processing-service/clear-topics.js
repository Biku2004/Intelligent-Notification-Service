// Clear Kafka topic messages
const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'topic-cleanup',
  brokers: ['localhost:9092'],
  logLevel: logLevel.ERROR
});

const admin = kafka.admin();

async function clearTopics() {
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka Admin\n');

    const topics = ['high-priority-notifications', 'critical-notifications', 'low-priority-notifications', 'ready-notifications'];

    console.log('🗑️  Deleting and recreating topics to clear all messages...\n');

    // Delete topics
    try {
      await admin.deleteTopics({ topics });
      console.log('   ✅ Topics deleted');
    } catch (error) {
      console.log('   ⚠️  Could not delete topics:', error.message);
    }

    // Wait a bit for deletion
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Recreate topics
    await admin.createTopics({
      topics: [
        {
          topic: 'critical-notifications',
          numPartitions: 3,
          replicationFactor: 1,
        },
        {
          topic: 'high-priority-notifications',
          numPartitions: 5,
          replicationFactor: 1,
        },
        {
          topic: 'low-priority-notifications',
          numPartitions: 2,
          replicationFactor: 1,
        },
        {
          topic: 'ready-notifications',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });
    console.log('   ✅ Topics recreated\n');

    await admin.disconnect();
    console.log('✅ Topic cleanup complete!');
    console.log('   → Restart processing-service to reconnect');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearTopics();
