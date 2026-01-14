// Reset Kafka consumer group offsets to process all pending messages
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'offset-reset-tool',
  brokers: ['localhost:9092'],
});

const admin = kafka.admin();

async function resetOffsets() {
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka Admin\n');

    const groups = ['high-priority-consumer', 'critical-consumer', 'low-priority-consumer'];

    for (const groupId of groups) {
      console.log(`🔄 Resetting offsets for: ${groupId}`);
      
      try {
        // Delete consumer group to reset offsets
        await admin.deleteGroups([groupId]);
        console.log(`   ✅ Consumer group deleted: ${groupId}`);
      } catch (error) {
        console.log(`   ⚠️ Could not delete ${groupId}: ${error.message}`);
      }
    }

    await admin.disconnect();
    console.log('\n✅ Offset reset complete!');
    console.log('   → Restart processing-service to re-read all messages');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetOffsets();
