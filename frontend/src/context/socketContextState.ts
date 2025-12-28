import { createContext } from 'react';
import type { Socket } from 'socket.io-client'; // Note "import type"
import type { NotificationEvent } from '../types'; // Note "import type"

export interface SocketContextType {
  socket: Socket | null;
  notifications: NotificationEvent[];
  unreadCount: number;
  markAsRead: () => void;
}

export const SocketContext = createContext<SocketContextType | null>(null);