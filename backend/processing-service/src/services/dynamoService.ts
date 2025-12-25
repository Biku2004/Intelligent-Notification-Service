import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:8000', // Docker DynamoDB
  credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
});

export const logNotification = async (event: any, status: 'SENT' | 'SUPPRESSED') => {
  const command = new PutItemCommand({
    TableName: 'NotificationLogs', // We need to create this table later!
    Item: {
      id: { S: uuidv4() },
      userId: { S: event.targetId },
      type: { S: event.type },
      status: { S: status },
      timestamp: { S: new Date().toISOString() },
    },
  });

  try {
    await client.send(command);
    console.log(`📝 Logged to DynamoDB: ${status}`);
  } catch (error) {
    console.error('❌ DynamoDB Error:', error);
  }
};