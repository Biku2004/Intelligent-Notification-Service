// Enhanced Preference Service with Notification History Storage
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { NotificationEvent } from '../../../shared/types';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Helper: Check if current time is within DND window
const isTimeInWindow = (startStr: string, endStr: string): boolean => {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes < endMinutes) {
    // Standard window (e.g., 14:00 to 16:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight window (e.g., 22:00 to 08:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
};

/**
 * Check if user preferences allow this notification
 */
export const checkUserPreferences = async (
  userId: string,
  eventType: string
): Promise<boolean> => {
  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // No preferences set = allow all by default
      return true;
    }

    // 1. Check DND (Do Not Disturb)
    if (
      preferences.dndEnabled &&
      preferences.dndStartTime &&
      preferences.dndEndTime
    ) {
      const isDND = isTimeInWindow(preferences.dndStartTime, preferences.dndEndTime);
      if (isDND) {
        console.log(`🌙 DND Active for ${userId}`);
        return false;
      }
    }

    // 2. Check channel preferences (for push notifications)
    if (!preferences.pushEnabled) {
      console.log(`🔕 Push disabled for ${userId}`);
      return false;
    }

    // 3. Check category filters
    const categoryMap: Record<string, keyof typeof preferences> = {
      LIKE: 'activity',
      COMMENT: 'activity',
      COMMENT_REPLY: 'activity',
      FOLLOW: 'social',
      BELL_POST: 'social',
      MENTION: 'activity',
      POST_SHARE: 'social',
      STORY_VIEW: 'activity',
      MARKETING: 'marketing',
      DIGEST: 'marketing',
    };

    const category = categoryMap[eventType];
    if (category && !preferences[category]) {
      console.log(`🚫 Category ${category} disabled for ${userId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Preference check error:', error);
    // Fail open: allow notification on error
    return true;
  }
};

/**
 * Save notification to PostgreSQL history
 */
export const saveNotificationHistory = async (
  event: NotificationEvent,
  status: 'PENDING' | 'SENT' | 'FAILED'
): Promise<void> => {
  try {
    await prisma.notificationHistory.create({
      data: {
        userId: event.targetId,
        type: event.type,
        priority: event.priority,
        actorId: event.actorId,
        actorName: event.actorName || null,
        actorAvatar: event.actorAvatar || null,
        isAggregated: !!(event.metadata?.isAggregated),
        aggregatedCount: event.metadata?.aggregatedCount || 1,
        aggregatedIds: event.metadata?.aggregatedActors || [],
        title: event.title || `New ${event.type.toLowerCase()}`,
        message: event.message || '',
        imageUrl: event.imageUrl || null,
        targetType: event.targetType || null,
        targetId: event.targetEntityId || null,
        isRead: false,
        deliveryStatus: status,
        channels: ['PUSH'], // Default to push, update when multi-channel is implemented
      },
    });

    console.log(`💾 Saved to history: ${event.type} for ${event.targetId}`);
  } catch (error) {
    console.error('❌ Error saving notification history:', error);
    // Don't throw - history storage failure shouldn't block notification
  }
};

export default { checkUserPreferences, saveNotificationHistory };