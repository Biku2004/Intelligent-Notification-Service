/**
 * Bell Toggle Component
 * Reusable bell notification toggle for user subscriptions
 * YouTube-style bell icon that controls post notifications
 */
import React, { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import axios from 'axios';
import { SOCIAL_API_URL } from '../config/api';

interface BellToggleProps {
  userId: string;
  isFollowing: boolean;
  bellEnabled: boolean;
  onToggle?: (newState: boolean) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button';
}

export const BellToggle: React.FC<BellToggleProps> = ({
  userId,
  isFollowing,
  bellEnabled,
  onToggle,
  size = 'medium',
  variant = 'icon',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [localBellState, setLocalBellState] = useState(bellEnabled);

  const iconSizes = {
    small: 16,
    medium: 20,
    large: 24,
  };

  const handleToggle = async () => {
    if (!isFollowing || isLoading) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        alert('Please login to toggle notifications');
        setIsLoading(false);
        return;
      }

      const response = await axios.post(
        `${SOCIAL_API_URL}/api/follows/${userId}/bell`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        const newState = response.data.bellEnabled;
        setLocalBellState(newState);
        onToggle?.(newState);
        
        // Show feedback toast
        const message = newState 
          ? '🔔 You\'ll be notified when they post!' 
          : '🔕 Post notifications turned off';
        console.log(message);
      }
    } catch (error: unknown) {
      console.error('Failed to toggle bell:', error);
      const err = error as { response?: { data?: { error?: string } } };
      const errorMsg = err.response?.data?.error || 'Failed to toggle notifications';
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isFollowing) {
    return null;
  }

  const iconSize = iconSizes[size];

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
          localBellState
            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
        }`}
        title={localBellState ? 'Turn off post notifications' : 'Turn on post notifications'}
      >
        {localBellState ? (
          <>
            <Bell size={iconSize} fill="currentColor" />
            <span>Notifications On</span>
          </>
        ) : (
          <>
            <BellOff size={iconSize} />
            <span>Notifications Off</span>
          </>
        )}
      </button>
    );
  }

  // Icon variant (default)
  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`p-2 rounded-lg transition disabled:opacity-50 ${
        localBellState
          ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
      }`}
      title={localBellState ? 'Turn off post notifications' : 'Turn on post notifications'}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full border-2 border-gray-300 border-t-purple-600" style={{ width: iconSize, height: iconSize }} />
      ) : localBellState ? (
        <Bell size={iconSize} fill="currentColor" />
      ) : (
        <BellOff size={iconSize} />
      )}
    </button>
  );
};
