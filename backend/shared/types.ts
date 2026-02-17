// Shared Types for Notification System

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'LOW';

export type NotificationType =
  | 'LIKE'
  | 'COMMENT'
  | 'COMMENT_REPLY'
  | 'FOLLOW'
  | 'BELL_POST' // Post from someone user subscribed to with bell
  | 'MENTION'
  | 'POST_SHARE'
  | 'STORY_VIEW'
  | 'OTP' // Critical
  | 'PASSWORD_RESET' // Critical
  | 'SECURITY_ALERT' // Critical
  | 'MARKETING' // Low priority
  | 'DIGEST' // Low priority
  | 'POST_UPDATED'; // Real-time feed update

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;

  // Actor (who triggered this notification)
  actorId: string;
  actorName?: string;
  actorAvatar?: string;

  // Target (who receives this notification)
  targetId: string;

  // Context
  targetType?: 'POST' | 'COMMENT' | 'USER' | 'STORY';
  targetEntityId?: string; // postId, commentId, etc.

  // Content
  title?: string;
  message?: string;
  imageUrl?: string;

  // Metadata
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AggregatedNotification extends NotificationEvent {
  isAggregated: true;
  aggregatedCount: number;
  aggregatedActors: string[]; // Array of actor IDs
  aggregatedNames: string[]; // Array of actor names
}

export interface NotificationDelivery {
  notificationId: string;
  userId: string;
  channels: ('PUSH' | 'EMAIL' | 'SMS')[];
  status: 'PENDING' | 'SENT' | 'FAILED';
  deliveredAt?: string;
  error?: string;
}

export interface UserPreferences {
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  marketing: boolean;
  activity: boolean;
  social: boolean;
  dndEnabled: boolean;
  dndStartTime?: string;
  dndEndTime?: string;
}

export interface BellSubscription {
  subscriberId: string;
  targetUserId: string;
  enabled: boolean;
}

// Frontend Types
export interface FrontendNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  title: string;
  message: string;
  imageUrl?: string;
  targetType?: string;
  targetId?: string;
  isRead: boolean;
  isAggregated?: boolean;
  aggregatedCount?: number;
  createdAt: string;
  timestamp: string;
}

// Kafka Topics by Priority
export const KAFKA_TOPICS = {
  CRITICAL: 'critical-notifications',
  HIGH: 'high-priority-notifications',
  LOW: 'low-priority-notifications',
  READY: 'ready-notifications', // After processing
  RAW: 'raw-events', // Before processing (legacy)
} as const;

// Priority determination helper
export function getPriorityForType(type: NotificationType): NotificationPriority {
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
    case 'POST_UPDATED':
      return 'LOW';

    default:
      return 'HIGH';
  }
}

// Kafka topic routing
export function getTopicForPriority(priority: NotificationPriority): string {
  switch (priority) {
    case 'CRITICAL':
      return KAFKA_TOPICS.CRITICAL;
    case 'HIGH':
      return KAFKA_TOPICS.HIGH;
    case 'LOW':
      return KAFKA_TOPICS.LOW;
    default:
      return KAFKA_TOPICS.HIGH;
  }
}
