// Quick diagnostic script to check Kafka topics
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'diagnostic-client',
  brokers: ['localhost:9092'],
});

const admin = kafka.admin();

async function checkKafka() {
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka\n');

    // List topics
    const topics = await admin.listTopics();
    console.log('📋 Available Topics:');
    topics.forEach(topic => console.log(`   - ${topic}`));
    
    console.log('\n📊 Topic Details:');
    const topicsMetadata = await admin.fetchTopicMetadata({ topics });
    
    for (const topic of topicsMetadata.topics) {
      console.log(`\n  Topic: ${topic.name}`);
      for (const partition of topic.partitions) {
        console.log(`    Partition ${partition.partitionId}:`);
        console.log(`      High Water Mark: ${partition.high}`);
        console.log(`      Low Water Mark: ${partition.low}`);
      }
    }

    // Check consumer groups
    console.log('\n👥 Consumer Groups:');
    const groups = await admin.listGroups();
    for (const group of groups.groups) {
      console.log(`   - ${group.groupId}`);
    }

    // Describe key groups (helps detect if another consumer is holding partitions)
    const interestingGroups = [
      'high-priority-consumer',
      'critical-consumer',
      'low-priority-consumer',
    ];

    const present = new Set(groups.groups.map(g => g.groupId));
    const toDescribe = interestingGroups.filter(g => present.has(g));

    if (toDescribe.length) {
      console.log('\n🔎 Consumer Group Details:');
      const described = await admin.describeGroups(toDescribe);
      for (const g of described.groups) {
        console.log(`\n  Group: ${g.groupId}`);
        console.log(`    State: ${g.state}`);
        console.log(`    Protocol: ${g.protocolType || 'n/a'} / ${g.protocol || 'n/a'}`);
        console.log(`    Members: ${g.members.length}`);
        for (const m of g.members) {
          const memberId = m.memberId || 'unknown-member';
          console.log(`    - Member: ${memberId}`);
          if (m.clientId) console.log(`      clientId: ${m.clientId}`);
          if (m.clientHost) console.log(`      clientHost: ${m.clientHost}`);

          // Attempt to decode assignment to show partitions
          try {
            const assignment = m.memberAssignment;
            if (assignment && assignment.assignment) {
              console.log(`      assignmentBytes: ${assignment.assignment.length}`);
            }
          } catch (_) {
            // ignore
          }
        }
      }
    } else {
      console.log('\nℹ️  None of the expected notification consumer groups exist yet.');
    }

    await admin.disconnect();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkKafka();
