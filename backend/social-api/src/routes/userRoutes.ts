/**
 * User Routes
 * /api/users/:userId - Get user profile
 * /api/users/:userId - Update user profile (authenticated)
 * /api/users/search - Search users by username
 */
import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/users/:userId
 * Get user profile with stats
 */
router.get('/:userId', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: userId
          }
        }
      });
      isFollowing = !!follow;
    }

    res.json({
      success: true,
      user: {
        ...user,
        postsCount: user._count.posts,
        followersCount: user._count.followers,
        followingCount: user._count.following,
        isFollowing,
      }
    });
  } catch (error: any) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/users/:userId
 * Update user profile (authenticated)
 */
router.patch('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    // Check if user is updating their own profile
    if (userId !== currentUserId) {
      res.status(403).json({ success: false, error: 'Cannot update another user\'s profile' });
      return;
    }

    const { name, bio, avatarUrl } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl && { avatarUrl }),
      },
      select: {
        id: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
        createdAt: true,
      }
    });

    res.json({
      success: true,
      user: updatedUser
    });
  } catch (error: any) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/users/search
 * Search users by username
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Search query required' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ]
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatarUrl: true,
        _count: {
          select: {
            followers: true,
          }
        }
      },
      take: 20,
    });

    res.json({
      success: true,
      users: users.map(u => ({
        ...u,
        followersCount: u._count.followers,
      }))
    });
  } catch (error: any) {
    console.error('❌ Search users error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as userRouter };
