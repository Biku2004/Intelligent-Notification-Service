// Check consumer group offsets and reset if needed
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'offset-checker',
  brokers: ['localhost:9092'],
});

const admin = kafka.admin();

async function checkAndResetOffsets() {
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka Admin\n');

    // Get current offsets for high-priority-consumer
    const groupId = 'high-priority-consumer';
    const topic = 'high-priority-notifications';

    console.log(`📊 Checking consumer group: ${groupId}`);
    
    try {
      const offsets = await admin.fetchOffsets({ groupId, topics: [topic] });
      console.log('Current offsets:', JSON.stringify(offsets, null, 2));
    } catch (e) {
      console.log('No offsets found for group (might be new)');
    }

    // Get topic high water mark
    const topicOffsets = await admin.fetchTopicOffsets(topic);
    console.log('\nTopic offsets (messages in topic):', JSON.stringify(topicOffsets, null, 2));

    // Reset consumer group to beginning
    console.log('\n🔄 Resetting consumer group offsets to EARLIEST...');
    
    // First delete the group
    try {
      await admin.deleteGroups([groupId]);
      console.log(`✅ Deleted consumer group: ${groupId}`);
    } catch (e) {
      console.log(`⚠️ Could not delete group: ${e.message}`);
    }

    // Also reset critical and low priority consumers
    try {
      await admin.deleteGroups(['critical-consumer', 'low-priority-consumer']);
      console.log('✅ Deleted other consumer groups');
    } catch (e) {
      console.log(`⚠️ ${e.message}`);
    }

    await admin.disconnect();
    console.log('\n✅ Done! Restart processing-service now.');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAndResetOffsets();
