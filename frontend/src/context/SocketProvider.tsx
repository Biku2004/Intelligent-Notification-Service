import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { NotificationEvent } from '../types';
import { SocketContext } from './socketContextState';
import { useAuth } from '../hooks/useAuth';
import { NOTIFICATION_API_URL, SOCKET_API_URL } from '../config/api';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // Initialize Socket Lazily - Socket service runs on port 4000
  const [socket] = useState(() => io(SOCKET_API_URL, { 
    autoConnect: false 
  }));
  
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from API on mount
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const response = await axios.get(`${NOTIFICATION_API_URL}/api/notifications/${user.id}?limit=50`);
        if (response.data.success && response.data.notifications) {
          const historicalNotifications = response.data.notifications.map((n: any) => ({
            id: n.id,
            type: n.type,
            priority: n.priority,
            actorId: n.actorId || '',
            actorName: n.actorName || 'Someone',
            actorAvatar: n.actorAvatar,
            title: n.title,
            message: n.message,
            imageUrl: n.imageUrl,
            isRead: n.isRead,
            timestamp: n.createdAt,
            metadata: {
              ...n.metadata,
              aggregatedCount: n.aggregatedCount,
              isAggregated: n.isAggregated,
            },
          }));
          setNotifications(historicalNotifications);
          
          const unread = response.data.notifications.filter((n: any) => !n.isRead).length;
          setUnreadCount(unread);
          console.log(`📥 Loaded ${historicalNotifications.length} notifications (${unread} unread)`);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) {
      socket.disconnect();
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