import express from 'express';
import { PrismaClient } from '../../../shared/prisma/generated/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/db/notification-history
 * Get all notification history records with timestamps
 */
router.get('/db/notification-history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const records = await prisma.notificationHistory.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                userId: true,
                type: true,
                priority: true,
                actorName: true,
                isAggregated: true,
                aggregatedCount: true,
                title: true,
                message: true,
                isRead: true,
                deliveryStatus: true,
                createdAt: true,
            }
        });

        const count = await prisma.notificationHistory.count();

        res.json({
            success: true,
            data: records,
            total: count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (notification-history):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/admin/db/likes
 * Get all likes with timestamps
 */
router.get('/db/likes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const records = await prisma.like.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                postId: true,
                userId: true,
                createdAt: true,
            }
        });

        const count = await prisma.like.count();

        res.json({
            success: true,
            data: records,
            total: count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (likes):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/admin/db/comments
 * Get all comments with timestamps
 */
router.get('/db/comments', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const records = await prisma.comment.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                postId: true,
                userId: true,
                content: true,
                createdAt: true,
            }
        });

        const count = await prisma.comment.count();

        res.json({
            success: true,
            data: records,
            total: count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (comments):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/admin/db/follows
 * Get all follows with timestamps
 */
router.get('/db/follows', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;

        const records = await prisma.follow.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                followerId: true,
                followingId: true,
                createdAt: true,
            }
        });

        const count = await prisma.follow.count();

        res.json({
            success: true,
            data: records,
            total: count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (follows):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/admin/db/stats
 * Get database statistics
 */
router.get('/db/stats', async (req, res) => {
    try {
        const [notificationCount, likeCount, commentCount, followCount] = await Promise.all([
            prisma.notificationHistory.count(),
            prisma.like.count(),
            prisma.comment.count(),
            prisma.follow.count(),
        ]);

        // Get recent activity (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const [recentNotifications, recentLikes, recentComments, recentFollows] = await Promise.all([
            prisma.notificationHistory.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
            prisma.like.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
            prisma.comment.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
            prisma.follow.count({ where: { createdAt: { gte: fiveMinutesAgo } } }),
        ]);

        res.json({
            success: true,
            data: {
                total: {
                    notifications: notificationCount,
                    likes: likeCount,
                    comments: commentCount,
                    follows: followCount,
                },
                recent: {
                    notifications: recentNotifications,
                    likes: recentLikes,
                    comments: recentComments,
                    follows: recentFollows,
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (stats):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /api/admin/db/clear
 * Clear all test data (use with caution!)
 */
router.delete('/db/clear', async (req, res) => {
    try {
        await prisma.$transaction([
            prisma.notificationHistory.deleteMany(),
            prisma.like.deleteMany(),
            prisma.comment.deleteMany(),
            prisma.follow.deleteMany(),
        ]);

        res.json({
            success: true,
            message: 'All test data cleared',
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Admin API error (clear):', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
