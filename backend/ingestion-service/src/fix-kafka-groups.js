/**
 * Fix Kafka Consumer Group Issues
 * 
 * Resolves "This is not the correct coordinator for this group" errors by:
 * 1. Deleting all consumer groups (clears stale metadata)
 * 2. Allowing services to rejoin with fresh state
 * 
 * Usage: node scripts/fix-kafka-groups.js
 * 
 * Run this when you see coordinator errors in processing-service or socket-service logs.
 */

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'fix-groups-script',
  brokers: ['localhost:9092'],
});

const admin = kafka.admin();

async function fixConsumerGroups() {
  console.log('🔧 Fixing Kafka consumer groups...\n');
  
  try {
    await admin.connect();
    console.log('✅ Connected to Kafka\n');

    // List all consumer groups
    const groups = await admin.listGroups();
    console.log(`📋 Found ${groups.groups.length} consumer groups:\n`);
    
    const groupIds = groups.groups.map(g => g.groupId);
    groupIds.forEach(id => console.log(`   - ${id}`));

    if (groupIds.length === 0) {
      console.log('\n✅ No consumer groups to delete');
      await admin.disconnect();
      return;
    }

    // Delete all consumer groups
    console.log('\n🗑️  Deleting consumer groups...\n');
    
    try {
      await admin.deleteGroups(groupIds);
      console.log('✅ Successfully deleted all consumer groups:\n');
      groupIds.forEach(id => console.log(`   ✓ ${id}`));
    } catch (error) {
      console.error('⚠️  Error deleting groups:', error.message);
      console.log('\nℹ️  This is usually OK - groups may not exist or are already empty');
    }

    await admin.disconnect();
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ DONE! Consumer groups have been reset');
    console.log('═'.repeat(60));
    console.log('\n📝 Next steps:');
    console.log('   1. Stop all services (Ctrl+C on start-all)');
    console.log('   2. Wait 5 seconds');
    console.log('   3. Restart services: npm run dev:all');
    console.log('\n   Services will rejoin with fresh group metadata.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   - Is Kafka running? (docker-compose ps)');
    console.error('   - Is Kafka healthy? (docker logs notif_kafka)');
    process.exit(1);
  }
}

fixConsumerGroups();
