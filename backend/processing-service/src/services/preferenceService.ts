import { PrismaClient } from '@prisma/client';

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

export const checkUserPreferences = async (userId: string, type: string): Promise<boolean> => {
  try {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // If no preferences set, default to ALLOW
    if (!prefs) return true;

    // 1. Global Kill Switch (if you had one, or Push disabled)
    if (!prefs.pushEnabled) {
      console.log(`⛔ Notification blocked: Push disabled for ${userId}`);
      return false;
    }

    // 2. Category Check
    if (type === 'MARKETING' && !prefs.marketing) return false;
    if ((type === 'LIKE' || type === 'COMMENT') && !prefs.activity) return false;

    // 3. Do Not Disturb (DND) Check
    if (prefs.dndEnabled && prefs.dndStartTime && prefs.dndEndTime) {
      const isDND = isTimeInWindow(prefs.dndStartTime, prefs.dndEndTime);
      if (isDND) {
        console.log(`🌙 Notification blocked: DND Active for ${userId}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Preference Check Error:', error);
    // Fail safe: If DB is down, do we send or block? 
    // Usually block to avoid spam, or allow critical. 
    return true; 
  }
};