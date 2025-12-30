/**
 * API Configuration
 * Centralized API endpoint configuration for all backend services
 */

// Social API - User authentication, posts, comments, likes, follows
export const SOCIAL_API_URL = import.meta.env.VITE_SOCIAL_API_URL || 'http://localhost:3003';

// Notification API - Notification history and preferences
export const NOTIFICATION_API_URL = import.meta.env.VITE_NOTIFICATION_API_URL || 'http://localhost:3002';

// Ingestion API - Event ingestion for testing
export const INGESTION_API_URL = import.meta.env.VITE_INGESTION_API_URL || 'http://localhost:3001';

// Socket API - Real-time WebSocket notifications
export const SOCKET_API_URL = import.meta.env.VITE_SOCKET_API_URL || 'http://localhost:3004';

export const API_CONFIG = {
  social: SOCIAL_API_URL,
  notification: NOTIFICATION_API_URL,
  ingestion: INGESTION_API_URL,
  socket: SOCKET_API_URL,
};
