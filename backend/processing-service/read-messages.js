// Read messages from high-priority-notifications topic
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'message-reader',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ 
  groupId: 'debug-consumer-' + Date.now() // Unique group to read all messages
});

async function readMessages() {
  try {
    await consumer.connect();
    console.log('✅ Connected to Kafka\n');

    await consumer.subscribe({ 
      topic: 'high-priority-notifications',
      fromBeginning: true 
    });

    console.log('📖 Reading messages from high-priority-notifications...\n');

    let messageCount = 0;
    const messages = [];

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        messageCount++;
        const value = message.value?.toString();
        const event = JSON.parse(value || '{}');
        
        messages.push({
          partition,
          offset: message.offset,
          type: event.type,
          target: event.targetId,
          actor: event.actorName,
          timestamp: event.timestamp
        });

        console.log(`Message #${messageCount}:`);
        console.log(`  Partition: ${partition} | Offset: ${message.offset}`);
        console.log(`  Type: ${event.type} | Target: ${event.targetId}`);
        console.log(`  Actor: ${event.actorName}`);
        console.log('');
      },
    });

    // Wait for 5 seconds to consume messages
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log(`\n📊 Total messages read: ${messageCount}`);
    
    await consumer.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

readMessages();
