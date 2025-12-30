import { Heart, MessageCircle, UserPlus, AtSign, Share2, Eye, Bell, Shield, Mail } from 'lucide-react';
import type { NotificationEvent } from '../types';

interface NotificationItemProps {
  notification: NotificationEvent;
  onClick?: () => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClick }) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'LIKE':
        return <Heart className="w-5 h-5 text-red-500" fill="currentColor" />;
      case 'COMMENT':
      case 'COMMENT_REPLY':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'FOLLOW':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'MENTION':
        return <AtSign className="w-5 h-5 text-purple-500" />;
      case 'POST_SHARE':
        return <Share2 className="w-5 h-5 text-indigo-500" />;
      case 'STORY_VIEW':
        return <Eye className="w-5 h-5 text-pink-500" />;
      case 'BELL_POST':
        return <Bell className="w-5 h-5 text-amber-500" fill="currentColor" />;
      case 'SECURITY_ALERT':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'PASSWORD_RESET':
      case 'OTP':
        return <Mail className="w-5 h-5 text-orange-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString();
  };

  const getPriorityBadge = () => {
    if (notification.priority === 'CRITICAL') {
      return <span className="ml-2 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">URGENT</span>;
    }
    return null;
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors flex items-start gap-3 ${
        !notification.isRead ? 'bg-blue-50' : ''
      }`}
    >
      {/* Avatar or Icon */}
      <div className="flex-shrink-0">
        {notification.actorAvatar ? (
          <img
            src={notification.actorAvatar}
            alt={notification.actorName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
            {getIcon()}
          </div>
        )}
        
        {/* Unread Indicator */}
        {!notification.isRead && (
          <div className="w-2 h-2 bg-blue-600 rounded-full absolute ml-8 -mt-2"></div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-900">
            {notification.actorName || notification.actorId}
            {getPriorityBadge()}
          </p>
          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
            {formatTimestamp(notification.timestamp)}
          </span>
        </div>

        <p className="text-sm text-gray-700">
          {notification.message || notification.title}
        </p>

        {/* Aggregation Info */}
        {notification.metadata?.isAggregated && notification.metadata.aggregatedCount && (
          <div className="mt-1 text-xs text-gray-500">
            +{notification.metadata.aggregatedCount - 1} other{notification.metadata.aggregatedCount > 2 ? 's' : ''}
          </div>
        )}

        {/* Image Preview */}
        {notification.imageUrl && (
          <img
            src={notification.imageUrl}
            alt="Notification preview"
            className="mt-2 w-20 h-20 object-cover rounded-md"
          />
        )}

        {/* Priority Indicator */}
        <div className="mt-2 flex items-center gap-2">
          {notification.priority === 'HIGH' && (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">High Priority</span>
          )}
          {notification.metadata?.channels && notification.metadata.channels.length > 0 && (
            <span className="text-xs text-gray-400">
              via {notification.metadata.channels.join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
