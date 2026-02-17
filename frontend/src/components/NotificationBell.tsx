import React, { useState, useEffect, useRef } from 'react';
import { Bell, Settings, CheckCheck } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { NotificationItem } from './NotificationItem';
import axios from 'axios';
import type { NotificationEvent } from '../types';
import { useAuth } from '../hooks/useAuth';
import { NOTIFICATION_API_URL } from '../config/api';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { unreadCount, notifications: liveNotifications, markAsRead: socketMarkAsRead } = useSocket();
  const currentUserId = user?.id;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [allNotifications, setAllNotifications] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch notification history when dropdown opens
  useEffect(() => {
    if (isOpen && allNotifications.length === 0 && currentUserId) {
      fetchNotifications();
    }
  }, [isOpen, allNotifications.length, currentUserId]);

  // Merge live notifications with fetched history
  useEffect(() => {
    if (liveNotifications.length > 0) {
      setAllNotifications(prev => {
        const newIds = liveNotifications.map(n => n.id);
        const filtered = prev.filter(n => !newIds.includes(n.id));
        return [...liveNotifications, ...filtered];
      });
    }
  }, [liveNotifications]);

  const fetchNotifications = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${NOTIFICATION_API_URL}/api/notifications/${currentUserId}`, {
        params: { limit: 50 },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        const fetchedNotifications = response.data.notifications.map((n: any) => ({
          id: n.id,
          type: n.type,
          priority: n.priority,
          actorId: n.actorId || 'unknown',
          actorName: n.actorName,
          actorAvatar: n.actorAvatar,
          title: n.title,
          message: n.message,
          imageUrl: n.imageUrl,
          targetId: n.targetId || n.userId,
          timestamp: n.createdAt || n.timestamp,
          isRead: n.isRead,
          metadata: {
            isAggregated: n.isAggregated,
            aggregatedCount: n.aggregatedCount,
            channels: Array.isArray(n.channels) ? n.channels : undefined,
          }
        }));
        setAllNotifications(fetchedNotifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUserId) return;
    try {
      const token = localStorage.getItem('authToken');
      await axios.patch(`${NOTIFICATION_API_URL}/api/notifications/${currentUserId}/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      socketMarkAsRead(); // Update socket context unread count
      setAllNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkOneAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.patch(`${NOTIFICATION_API_URL}/api/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const filteredNotifications = activeTab === 'unread'
    ? allNotifications.filter(n => !n.isRead)
    : allNotifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 hover:bg-gray-800 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell size={24} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white text-black shadow-2xl rounded-lg overflow-hidden z-50 border border-gray-200">
          {/* Header */}
          <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={18} className="text-green-600" />
                </button>
                <button
                  className="p-2 hover:bg-white rounded-full transition-colors"
                  title="Settings"
                >
                  <Settings size={18} className="text-gray-600" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mt-3">
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'all'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                All ({allNotifications.length})
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'unread'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Unread ({allNotifications.filter(n => !n.isRead).length})
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Loading...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="font-medium">No notifications yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  {activeTab === 'unread' ? "You're all caught up!" : "We'll notify you when something happens"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleMarkOneAsRead(notification.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="p-3 border-t bg-gray-50 text-center">
              <button className="text-sm text-purple-600 font-medium hover:text-purple-700 transition-colors">
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
