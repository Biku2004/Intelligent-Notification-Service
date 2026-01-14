"use strict";
// Shared Types for Notification System
Object.defineProperty(exports, "__esModule", { value: true });
exports.KAFKA_TOPICS = void 0;
exports.getPriorityForType = getPriorityForType;
exports.getTopicForPriority = getTopicForPriority;
// Kafka Topics by Priority
exports.KAFKA_TOPICS = {
    CRITICAL: 'critical-notifications',
    HIGH: 'high-priority-notifications',
    LOW: 'low-priority-notifications',
    READY: 'ready-notifications', // After processing
    RAW: 'raw-events', // Before processing (legacy)
};
// Priority determination helper
function getPriorityForType(type) {
    switch (type) {
        case 'OTP':
        case 'PASSWORD_RESET':
        case 'SECURITY_ALERT':
            return 'CRITICAL';
        case 'LIKE':
        case 'COMMENT':
        case 'COMMENT_REPLY':
        case 'FOLLOW':
        case 'BELL_POST':
        case 'MENTION':
        case 'POST_SHARE':
        case 'STORY_VIEW':
            return 'HIGH';
        case 'MARKETING':
        case 'DIGEST':
            return 'LOW';
        default:
            return 'HIGH';
    }
}
// Kafka topic routing
function getTopicForPriority(priority) {
    switch (priority) {
        case 'CRITICAL':
            return exports.KAFKA_TOPICS.CRITICAL;
        case 'HIGH':
            return exports.KAFKA_TOPICS.HIGH;
        case 'LOW':
            return exports.KAFKA_TOPICS.LOW;
        default:
            return exports.KAFKA_TOPICS.HIGH;
    }
}
