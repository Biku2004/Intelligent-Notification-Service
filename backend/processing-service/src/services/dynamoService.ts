import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMO_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
  requestHandler: {
    requestTimeout: 3000, // 3 second timeout
  } as any,
});

// Flag to track if DynamoDB is available
let dynamoAvailable = true;
let lastError: Date | null = null;

export const logNotification = async (event: any, status: 'SENT' | 'SUPPRESSED' | 'FILTERED_PREFS' | 'FAILED') => {
  // Skip if DynamoDB has been failing (rate limit retries)
  if (!dynamoAvailable && lastError && (Date.now() - lastError.getTime()) < 30000) {
    // Skip for 30 seconds after error
    return;
  }

  const command = new PutItemCommand({
    TableName: 'NotificationLogs',
    Item: {
      id: { S: uuidv4() },
      userId: { S: event.targetId },
      type: { S: event.type },
      status: { S: status },
      timestamp: { S: new Date().toISOString() },
      expiresAt: { N: Math.floor((Date.now() / 1000) + (30 * 24 * 60 * 60)).toString() }, // TTL: 30 days
    },
  });

  // Fire and forget - don't block on DynamoDB
  client.send(command)
    .then(() => {
      dynamoAvailable = true;
      console.log(`📝 Logged to DynamoDB: ${status}`);
    })
    .catch((error) => {
      dynamoAvailable = false;
      lastError = new Date();
      // Only log first error, not every one
      if (dynamoAvailable) {
        console.error('❌ DynamoDB unavailable - logging disabled for 30s:', error.message);
      }
    });
};