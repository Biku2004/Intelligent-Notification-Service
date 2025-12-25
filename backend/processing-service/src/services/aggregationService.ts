import redis from '../config/redis';

export const shouldSendNotification = async (targetUserId: string, type: string): Promise<boolean> => {
  const key = `rate_limit:${targetUserId}:${type}`;
  
  // Check if key exists
  const exists = await redis.get(key);
  
  if (exists) {
    console.log(`⚠️ Notification suppressed (Rate Limit) for ${targetUserId}`);
    return false; // Don't send
  }

  // Set key with 60 second expiry (Simple Aggregation Window)
  await redis.set(key, '1', 'EX', 60);
  return true; // Send
};