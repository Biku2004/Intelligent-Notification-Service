// Authentication & User types
export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: string;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  bellEnabled?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user: User;
  token: string;
}

// Post types
export interface Post {
  id: string;
  userId: string;
  caption?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    name?: string;
    avatarUrl?: string;
  };
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
}

// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  gifUrl?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    name?: string;
    avatarUrl?: string;
  };
  replies?: Comment[];
}

// Notification types
export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'LOW';

export type NotificationType = 
  | 'LIKE'
  | 'COMMENT'
  | 'COMMENT_REPLY'
  | 'FOLLOW'
  | 'BELL_POST'
  | 'MENTION'
  | 'POST_SHARE'
  | 'STORY_VIEW'
  | 'OTP'
  | 'PASSWORD_RESET'
  | 'SECURITY_ALERT'
  | 'MARKETING'
  | 'DIGEST';

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
  title?: string;
  message?: string;
  imageUrl?: string;
  timestamp: string;
  isRead?: boolean;
  metadata?: {
    isAggregated?: boolean;
    aggregatedCount?: number;
    aggregatedActors?: string[];
    channels?: ('PUSH' | 'EMAIL' | 'SMS')[];
    [key: string]: unknown;
  };
}

export interface NotificationHistory {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  actorId: string;
  actorName?: string;
  actorAvatar?: string;
  isAggregated: boolean;
  aggregatedCount: number;
  aggregatedIds?: string[];
  title?: string;
  message?: string;
  imageUrl?: string;
  targetType?: string;
  targetId?: string;
  isRead: boolean;
  readAt?: Date;
  deliveryStatus?: string;
  channels?: string[];
  createdAt: Date;
}

export interface UserPreferences {
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