import React from 'react';
import { X, Heart, MessageCircle, UserPlus, Bell } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'bell_post';
  message: string;
  actorName: string;
  actorAvatar?: string;
  imageUrl?: string;
  count?: number;
}

interface ToastNotificationProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onClose }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle className="w-5 h-5 text-blue-500" />;
      case 'follow':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'bell_post':
        return <Bell className="w-5 h-5 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 mb-3 flex items-start gap-3 animate-slide-in max-w-sm">
      {/* Icon */}
      <div className="flex-shrink-0 mt-1">
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {/* Actor Avatar */}
          {toast.actorAvatar && (
            <img
              src={toast.actorAvatar}
              alt={toast.actorName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          )}

          {/* Message */}
          <div className="flex-1">
            <p className="text-sm text-gray-900 font-medium">
              {toast.actorName}
            </p>
            <p className="text-sm text-gray-600">{toast.message}</p>
            {toast.count && toast.count > 1 && (
              <p className="text-xs text-gray-500 mt-1">
                and {toast.count - 1} other{toast.count > 2 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Post Image */}
          {toast.imageUrl && (
            <img
              src={toast.imageUrl}
              alt="Post"
              className="w-12 h-12 rounded object-cover flex-shrink-0"
            />
          )}
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-3">
      {toasts.map(toast => (
        <ToastNotification key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};
