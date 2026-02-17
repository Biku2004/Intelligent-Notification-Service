/**
 * Bookmark Routes
 * POST /api/bookmarks/:postId - Toggle bookmark on a post
 * GET /api/bookmarks - Get all bookmarked posts for the authenticated user
 * GET /api/bookmarks/:postId/status - Check if a post is bookmarked
 */
import express, { Response } from 'express';
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/bookmarks/:postId
 * Toggle bookmark on a post (add if not bookmarked, remove if already bookmarked)
 */
router.post('/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { postId } = req.params;
        const userId = req.userId!;

        // Check if already bookmarked
        const existing = await prisma.bookmark.findUnique({
            where: {
                postId_userId: { postId, userId }
            }
        });

        if (existing) {
            // Un-bookmark
            await prisma.bookmark.delete({
                where: { id: existing.id }
            });
            res.json({ success: true, bookmarked: false });
        } else {
            // Bookmark
            await prisma.bookmark.create({
                data: { postId, userId }
            });
            res.json({ success: true, bookmarked: true });
        }
    } catch (error: any) {
        console.error('❌ Toggle bookmark error:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle bookmark' });
    }
});

/**
 * GET /api/bookmarks
 * Get all bookmarked posts for the authenticated user
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        const bookmarks = await prisma.bookmark.findMany({
            where: { userId },
            include: {
                post: {
                    include: {
                        user: {
                            select: { id: true, username: true, name: true, avatarUrl: true }
                        },
                        _count: { select: { likes: true, comments: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            bookmarks: bookmarks.map(b => ({
                ...b.post,
                bookmarkedAt: b.createdAt,
                likesCount: b.post._count.likes,
            }))
        });
    } catch (error: any) {
        console.error('❌ Get bookmarks error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch bookmarks' });
    }
});

/**
 * GET /api/bookmarks/check?postIds=id1,id2,id3
 * Check bookmark status for multiple posts at once (used by feed)
 */
router.get('/check', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;
        const postIdsParam = req.query.postIds as string;

        if (!postIdsParam) {
            res.json({ success: true, bookmarkedPostIds: [] });
            return;
        }

        const postIds = postIdsParam.split(',');

        const bookmarks = await prisma.bookmark.findMany({
            where: {
                userId,
                postId: { in: postIds }
            },
            select: { postId: true }
        });

        res.json({
            success: true,
            bookmarkedPostIds: bookmarks.map(b => b.postId)
        });
    } catch (error: any) {
        console.error('❌ Check bookmarks error:', error);
        res.status(500).json({ success: false, error: 'Failed to check bookmarks' });
    }
});

export { router as bookmarkRouter };
