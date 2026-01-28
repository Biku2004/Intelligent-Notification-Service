import redis from '../../processing-service/src/config/redis';

/**
 * Redis Cache Service
 * Provides write-through cache for social actions (likes, comments, follows)
 * Enables instant counts while maintaining batched PostgreSQL writes
 */

const CACHE_TTL = 180; // 3 minutes (slightly longer than 2-minute batch window)

/**
 * Increment like count in Redis cache
 */
export async function incrementLikeCount(postId: string): Promise<number> {
    const key = `like:count:${postId}`;
    const newCount = await redis.incr(key);

    // Set TTL on first increment
    if (newCount === 1) {
        await redis.expire(key, CACHE_TTL);
    }

    console.log(`📈 Redis: Incremented like count for post ${postId} → ${newCount}`);
    return newCount;
}

/**
 * Get like count from Redis cache, fallback to PostgreSQL
 */
export async function getLikeCount(postId: string, prisma: any): Promise<number> {
    const key = `like:count:${postId}`;
    const cachedCount = await redis.get(key);

    if (cachedCount !== null) {
        console.log(`✅ Redis: Cache hit for post ${postId} → ${cachedCount}`);
        return parseInt(cachedCount, 10);
    }

    // Cache miss - query PostgreSQL
    const dbCount = await prisma.like.count({ where: { postId } });
    console.log(`💾 PostgreSQL: Queried like count for post ${postId} → ${dbCount}`);

    // Optionally warm cache with DB value
    if (dbCount > 0) {
        await redis.setex(key, CACHE_TTL, dbCount.toString());
    }

    return dbCount;
}

/**
 * Increment comment count in Redis cache
 */
export async function incrementCommentCount(postId: string): Promise<number> {
    const key = `comment:count:${postId}`;
    const newCount = await redis.incr(key);

    if (newCount === 1) {
        await redis.expire(key, CACHE_TTL);
    }

    console.log(`📈 Redis: Incremented comment count for post ${postId} → ${newCount}`);
    return newCount;
}

/**
 * Get comment count from Redis cache, fallback to PostgreSQL
 */
export async function getCommentCount(postId: string, prisma: any): Promise<number> {
    const key = `comment:count:${postId}`;
    const cachedCount = await redis.get(key);

    if (cachedCount !== null) {
        return parseInt(cachedCount, 10);
    }

    const dbCount = await prisma.comment.count({ where: { postId } });

    if (dbCount > 0) {
        await redis.setex(key, CACHE_TTL, dbCount.toString());
    }

    return dbCount;
}

/**
 * Increment follow count in Redis cache
 */
export async function incrementFollowCount(userId: string): Promise<number> {
    const key = `follow:count:${userId}`;
    const newCount = await redis.incr(key);

    if (newCount === 1) {
        await redis.expire(key, CACHE_TTL);
    }

    console.log(`📈 Redis: Incremented follow count for user ${userId} → ${newCount}`);
    return newCount;
}

/**
 * Get follow count from Redis cache, fallback to PostgreSQL
 */
export async function getFollowCount(userId: string, prisma: any): Promise<number> {
    const key = `follow:count:${userId}`;
    const cachedCount = await redis.get(key);

    if (cachedCount !== null) {
        return parseInt(cachedCount, 10);
    }

    const dbCount = await prisma.follow.count({ where: { followingId: userId } });

    if (dbCount > 0) {
        await redis.setex(key, CACHE_TTL, dbCount.toString());
    }

    return dbCount;
}

/**
 * Clear cache for a specific post (called after batch write to PostgreSQL)
 */
export async function clearPostCache(postId: string): Promise<void> {
    const likeKey = `like:count:${postId}`;
    const commentKey = `comment:count:${postId}`;

    await Promise.all([
        redis.del(likeKey),
        redis.del(commentKey)
    ]);

    console.log(`🗑️ Redis: Cleared cache for post ${postId}`);
}

/**
 * Clear cache for a specific user (called after batch write to PostgreSQL)
 */
export async function clearUserCache(userId: string): Promise<void> {
    const followKey = `follow:count:${userId}`;
    await redis.del(followKey);

    console.log(`🗑️ Redis: Cleared cache for user ${userId}`);
}

/**
 * Get all cached post IDs with like counts
 */
export async function getCachedPostIds(): Promise<string[]> {
    const keys = await redis.keys('like:count:*');
    return keys.map((key: string) => key.replace('like:count:', ''));
}
