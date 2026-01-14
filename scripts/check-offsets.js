const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'offset-checker',
  brokers: ['localhost:9092'],
});

const admin = kafka.admin();

async function checkOffsets() {
  await admin.connect();
  console.log('Connected to Kafka admin\n');

  // Check consumer group offsets
  const groups = ['high-priority-consumer', 'critical-consumer', 'low-priority-consumer'];
  
  for (const groupId of groups) {
    try {
      const offsets = await admin.fetchOffsets({ 
        groupId, 
        topics: ['high-priority-notifications', 'critical-notifications', 'low-priority-notifications'] 
      });
      console.log(`\n${groupId}:`);
      offsets.forEach(t => {
        t.partitions.forEach(p => {
          if (p.offset !== '-1') {
            console.log(`  ${t.topic}[${p.partition}] committed offset = ${p.offset}`);
          }
        });
      });
    } catch (e) {
      console.log(`${groupId}: ${e.message}`);
    }
  }
  
  // Check topic end offsets (latest message position)
  const topics = await admin.fetchTopicOffsets('high-priority-notifications');
  console.log('\n\nhigh-priority-notifications END OFFSETS (where producers have written to):');
  topics.forEach(p => console.log(`  partition ${p.partition}: high=${p.high}, low=${p.low}`));
  
  // Check consumer group status
  const groupDesc = await admin.describeGroups(['high-priority-consumer']);
  console.log('\n\nhigh-priority-consumer GROUP STATUS:');
  groupDesc.groups.forEach(g => {
    console.log(`  State: ${g.state}`);
    console.log(`  Members: ${g.members.length}`);
    g.members.forEach(m => {
      console.log(`    - ${m.memberId.substring(0, 50)}...`);
    });
  });
  
  await admin.disconnect();
}

checkOffsets().catch(console.error);
