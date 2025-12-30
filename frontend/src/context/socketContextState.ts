import { createContext } from 'react';
import type { Socket } from 'socket.io-client';
import type { NotificationEvent } from '../types';

export interface SocketContextType {
  socket: Socket | null;
  notifications: NotificationEvent[];
  unreadCount: number;
  markAsRead: () => void;
  clearNotification: (notificationId: string) => void;
}

export const SocketContext = createContext<SocketContextType | null>(null);