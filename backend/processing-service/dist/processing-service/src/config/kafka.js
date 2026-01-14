"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectKafka = exports.producer = exports.consumer = void 0;
// backend/processing-service/src/config/kafka.ts
const kafkajs_1 = require("kafkajs");
const kafka = new kafkajs_1.Kafka({
    clientId: 'processing-service',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    logLevel: kafkajs_1.logLevel.ERROR,
    retry: {
        initialRetryTime: 100,
        retries: 8,
    },
});
exports.consumer = kafka.consumer({
    groupId: 'processing-group',
    sessionTimeout: 30000,
    heartbeatInterval: 3000,
});
exports.producer = kafka.producer();
const connectKafka = async () => {
    await exports.consumer.connect();
    await exports.producer.connect();
    // Subscribe to the raw events topic
    await exports.consumer.subscribe({ topic: 'raw-events', fromBeginning: true });
    console.log('✅ Kafka Consumer & Producer Connected');
};
exports.connectKafka = connectKafka;
