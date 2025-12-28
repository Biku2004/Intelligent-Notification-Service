import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { NotificationEvent } from '../types'; // Fix 1: "import type"
import { SocketContext } from './socketContextState'; // Import the separated context

const CURRENT_USER_ID = 'user_999';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize Socket Lazily
  const [socket] = useState(() => io('http://localhost:4000', { 
    autoConnect: false 
  }));
  
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    socket.connect();
    socket.emit('join_room', CURRENT_USER_ID);

    const handleNotification = (data: NotificationEvent) => {
      console.log('🔔 New Notification:', data);
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
      socket.disconnect();
    };
  }, [socket]);

  const markAsRead = () => setUnreadCount(0);

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead }}>
      {children}
    </SocketContext.Provider>
  );
};