"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
    // Enable TTL (must be done after table creation)
    try {
        // Wait for table to be active
        const { waitUntilTableExists } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-dynamodb')));
        await waitUntilTableExists({ client, maxWaitTime: 20 }, { TableName: 'NotificationLogs' });
        const { UpdateTimeToLiveCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-dynamodb')));
        const updateTTLCommand = new UpdateTimeToLiveCommand({
            TableName: 'NotificationLogs',
            TimeToLiveSpecification: {
                Enabled: true,
                AttributeName: 'expiresAt',
            },
        });
        await client.send(updateTTLCommand);
        console.log('✅ TTL enabled on NotificationLogs table');
    }
    catch (error) {
        console.error('⚠️  Error enabling TTL (might be already enabled):', error);
    }
};
exports.createNotificationLogsTable = createNotificationLogsTable;
// Run if called directly
if (require.main === module) {
    createNotificationLogsTable()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
