/**
 * Standalone High Priority Consumer Test
 * 
 * Tests if we can connect and consume from high-priority-notifications
 * independently from processing-service.
 * 
 * Usage: node scripts/test-high-priority-consumer.js
 */

const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'test-high-priority-client',
  brokers: ['localhost:9092'],
  logLevel: logLevel.INFO, // Show all logs
});

const consumer = kafka.consumer({ 
  groupId: 'test-high-priority-consumer-' + Date.now(), // Unique group
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

async function test() {
  console.log('🧪 Testing High Priority Consumer...\n');
  
  try {
    console.log('1. Connecting...');
    await consumer.connect();
    console.log('   ✅ Connected\n');
    
    console.log('2. Subscribing to high-priority-notifications...');
    await consumer.subscribe({ 
      topic: 'high-priority-notifications', 
      fromBeginning: true 
    });
    console.log('   ✅ Subscribed\n');
    
    console.log('3. Starting consumer.run()...');
    let messageCount = 0;
    
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        const value = message.value?.toString();
        const event = JSON.parse(value || '{}');
        console.log(`\n   📨 Message #${messageCount}:`);
        console.log(`      Topic: ${topic} | Partition: ${partition} | Offset: ${message.offset}`);
        console.log(`      Type: ${event.type} | Target: ${event.targetId}`);
        console.log(`      Actor: ${event.actorName || event.actorId}`);
      },
    });
    
    console.log('   ✅ Consumer running!\n');
    console.log('   Waiting 30 seconds to receive messages...');
    console.log('   (Press Ctrl+C to stop)\n');
    
    // Wait and show progress
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (i % 5 === 4) {
        console.log(`   ... ${i + 1}s elapsed, ${messageCount} messages received`);
      }
    }
    
    console.log(`\n✅ Test complete! Received ${messageCount} messages.`);
    
    await consumer.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Consumer test failed:', error.message);
    console.error(error);
    await consumer.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n⏹️  Stopping consumer...');
  await consumer.disconnect();
  process.exit(0);
});

test();
