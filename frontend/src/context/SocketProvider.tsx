import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import type { NotificationEvent } from '../types';
import { SocketContext } from './socketContextState';
import { useAuth } from '../hooks/useAuth';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Initialize Socket Lazily - Socket service runs on port 4000
  const [socket] = useState(() => io('http://localhost:4000', { 
    autoConnect: false 
  }));
  
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      socket.disconnect();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    socket.connect();
    socket.emit('join_room', user.id);

    console.log('✅ Socket connected for user:', user.id);

    const handleNotification = (data: NotificationEvent) => {
      console.log('🔔 Notification received:', data);
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
      socket.disconnect();
    };
  }, [socket, user]);

  const markAsRead = () => setUnreadCount(0);
  
  const clearNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, clearNotification }}>
      {children}
    </SocketContext.Provider>
  );
};