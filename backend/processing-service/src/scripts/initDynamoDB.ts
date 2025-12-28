// DynamoDB Table Initialization Script
import { DynamoDB } from 'aws-sdk';
import dotenv from 'dotenv';

dotenv.config();

const dynamodb = new DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMO_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

const createNotificationLogsTable = async () => {
  const params: DynamoDB.CreateTableInput = {
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
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'PriorityIndex',
        KeySchema: [
          { AttributeName: 'priority', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10,
    },
  };

  try {
    await dynamodb.createTable(params).promise();
    console.log('✅ NotificationLogs table created successfully');
  } catch (error: any) {
    if (error.code === 'ResourceInUseException') {
      console.log('⚠️  NotificationLogs table already exists');
    } else {
      console.error('❌ Error creating table:', error);
      throw error;
    }
  }
};

// Run if called directly
if (require.main === module) {
  createNotificationLogsTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { createNotificationLogsTable };
