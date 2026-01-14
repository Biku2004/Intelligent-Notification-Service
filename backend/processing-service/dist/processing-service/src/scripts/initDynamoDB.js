"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotificationLogsTable = void 0;
// DynamoDB Table Initialization Script
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client = new client_dynamodb_1.DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
    endpoint: process.env.DYNAMO_ENDPOINT || 'http://localhost:8000',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    },
});
const createNotificationLogsTable = async () => {
    const params = {
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
        const command = new client_dynamodb_1.CreateTableCommand(params);
        await client.send(command);
        console.log('✅ NotificationLogs table created successfully');
    }
    catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log('⚠️  NotificationLogs table already exists');
        }
        else {
            console.error('❌ Error creating table:', error);
            throw error;
        }
    }
};
exports.createNotificationLogsTable = createNotificationLogsTable;
// Run if called directly
if (require.main === module) {
    createNotificationLogsTable()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
