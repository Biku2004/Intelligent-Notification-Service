/**
 * Socket Provider with Automatic Reconnection
 * Manages WebSocket connection with exponential backoff retry strategy
 * 
 * RELIABILITY: P1 Fix #2 - WebSocket reconnection strategy
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import type { NotificationEvent } from '../types';
import { SocketContext } from './socketContextState';
import { useAuth } from '../hooks/useAuth';
import { NOTIFICATION_API_URL, SOCKET_API_URL } from '../config/api';

// Connection state for UI feedback
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

// Exponential backoff configuration
const INITIAL_RETRY_DELAY = 1000;  // 1 second
const MAX_RETRY_DELAY = 30000;     // 30 seconds max
const MAX_RETRIES = 10;            // Maximum reconnection attempts

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  // Retry state
  const retryCount = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Calculate next retry delay using exponential backoff with jitter
   */
  const getRetryDelay = useCallback(() => {
    const exponentialDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount.current);
    const jitter = Math.random() * 1000; // Add random jitter up to 1 second
    return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY);
  }, []);

  /**
   * Handle reconnection with exponential backoff
   */
  const scheduleReconnect = useCallback(() => {
    if (retryCount.current >= MAX_RETRIES) {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
      setConnectionState('disconnected');
      return;
    }

    const delay = getRetryDelay();
    console.log(`🔄 Reconnecting in ${Math.round(delay / 1000)}s (attempt ${retryCount.current + 1}/${MAX_RETRIES})`);
    setConnectionState('reconnecting');

    retryTimeoutRef.current = setTimeout(() => {
      retryCount.current++;
      socket?.connect();
    }, delay);
  }, [socket, getRetryDelay]);

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = useCallback(async () => {
    if (!user || !token) return;

    try {
      const response = await axios.get(
        `${NOTIFICATION_API_URL}/api/notifications/${user.id}?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

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
    } catch (error: any) {
      // Handle 401 gracefully - token might be expired
      if (error.response?.status === 401) {
        console.warn('⚠️ Authentication required for notifications');
      } else {
        console.error('Failed to fetch notifications:', error);
      }
    }
  }, [user, token]);

  // Initialize socket connection
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setConnectionState('disconnected');
      return;
    }

    // Create socket with reconnection options
    const newSocket = io(SOCKET_API_URL, {
      autoConnect: false,
      reconnection: false, // We'll handle reconnection ourselves
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('✅ Socket connected');
      setConnectionState('connected');
      retryCount.current = 0; // Reset retry count on successful connection

      // Join user's room
      newSocket.emit('join_room', user.id);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`⚠️ Socket disconnected: ${reason}`);
      setConnectionState('disconnected');

      // Only auto-reconnect for unexpected disconnections
      if (reason !== 'io client disconnect') {
        scheduleReconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      setConnectionState('disconnected');
      scheduleReconnect();
    });

    // Notification handler
    newSocket.on('notification', (data: NotificationEvent) => {
      console.log('🔔 Notification received:', data);
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });

    setSocket(newSocket);
    setConnectionState('connecting');
    newSocket.connect();

    // Fetch initial notifications
    fetchNotifications();

    // Cleanup
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      newSocket.off('notification');
      newSocket.disconnect();
    };
  }, [user]); // Only re-initialize socket when user changes

  /**
   * Manual reconnect function for UI
   */
  const reconnect = useCallback(() => {
    retryCount.current = 0;
    socket?.connect();
  }, [socket]);

  /**
   * Mark all notifications as read
   */
  const markAsRead = useCallback(async () => {
    setUnreadCount(0);

    if (user && token) {
      try {
        await axios.patch(
          `${NOTIFICATION_API_URL}/api/notifications/${user.id}/read-all`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (error) {
        console.error('Failed to mark notifications as read:', error);
      }
    }
  }, [user, token]);

  /**
   * Clear a specific notification
   */
  const clearNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  /**
   * Refresh notifications from server
   */
  const refreshNotifications = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return (
    <SocketContext.Provider value={{
      socket,
      notifications,
      unreadCount,
      markAsRead,
      clearNotification,
      connectionState,
      reconnect,
      refreshNotifications
    }}>
      {children}
    </SocketContext.Provider>
  );
};