// DynamoDB Table Initialization Script
import { DynamoDBClient, CreateTableCommand, CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMO_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

const createNotificationLogsTable = async () => {
  const params: CreateTableCommandInput = {
    TableName: 'NotificationLogs',
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }, // Partition key
      { AttributeName: 'createdAt', KeyType: 'RANGE' }, // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'priority', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'PriorityIndex',
        KeySchema: [
          { AttributeName: 'priority', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST', // On-Demand capacity for bursty/unpredictable load
  };

  try {
    const command = new CreateTableCommand(params);
    await client.send(command);
    console.log('✅ NotificationLogs table created successfully');
  } catch (error: any) {
    if (error.name === 'ResourceInUseException') {
      console.log('⚠️  NotificationLogs table already exists');
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }

  // Enable TTL (must be done after table creation)
  try {
    // Wait for table to be active
    const { waitUntilTableExists } = await import('@aws-sdk/client-dynamodb');
    await waitUntilTableExists({ client, maxWaitTime: 20 }, { TableName: 'NotificationLogs' });

    const { UpdateTimeToLiveCommand } = await import('@aws-sdk/client-dynamodb');
    const updateTTLCommand = new UpdateTimeToLiveCommand({
      TableName: 'NotificationLogs',
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'expiresAt',
      },
    });

    await client.send(updateTTLCommand);
    console.log('✅ TTL enabled on NotificationLogs table');
  } catch (error) {
    console.error('⚠️  Error enabling TTL (might be already enabled):', error);
  }
};

// Run if called directly
if (require.main === module) {
  createNotificationLogsTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { createNotificationLogsTable };
