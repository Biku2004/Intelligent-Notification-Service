"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logNotification = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const uuid_1 = require("uuid");
const client = new client_dynamodb_1.DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://localhost:8000', // Docker DynamoDB
    credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
});
const logNotification = async (event, status) => {
    const command = new client_dynamodb_1.PutItemCommand({
        TableName: 'NotificationLogs', // We need to create this table later!
        Item: {
            id: { S: (0, uuid_1.v4)() },
            userId: { S: event.targetId },
            type: { S: event.type },
            status: { S: status },
            timestamp: { S: new Date().toISOString() },
        },
    });
    try {
        await client.send(command);
        console.log(`📝 Logged to DynamoDB: ${status}`);
    }
    catch (error) {
        console.error('❌ DynamoDB Error:', error);
    }
};
exports.logNotification = logNotification;
