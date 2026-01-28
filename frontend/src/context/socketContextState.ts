import { createContext } from 'react';
import type { Socket } from 'socket.io-client';
import type { NotificationEvent } from '../types';

// Connection state for UI feedback
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface SocketContextType {
  socket: Socket | null;
  notifications: NotificationEvent[];
  unreadCount: number;
  markAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  // P1 Reliability: Connection state and reconnection
  connectionState: ConnectionState;
  reconnect: () => void;
  refreshNotifications: () => void;
}

export const SocketContext = createContext<SocketContextType | null>(null);