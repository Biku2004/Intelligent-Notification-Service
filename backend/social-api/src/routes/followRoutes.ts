/**
 * Follow Routes
 * /api/follows/:userId - Follow/Unfollow user (authenticated)
 * /api/follows/:userId/followers - Get user's followers
 * /api/follows/:userId/following - Get users that user is following
 * /api/follows/:userId/bell - Toggle bell subscription (authenticated)
 */
import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendNotificationEvent } from '../utils/kafka';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/follows/:userId
 * Follow/Unfollow a user
 */
router.post('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const followingId = req.params.userId;
    const followerId = req.userId!;

    if (followingId === followerId) {
      res.status(400).json({ success: false, error: 'Cannot follow yourself' });
      return;
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, username: true, name: true }
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId
        }
      }
    });

    let following = false;

    if (existingFollow) {
      // Unfollow
      await prisma.follow.delete({
        where: { id: existingFollow.id }
      });
      
      // Also remove bell subscription
      await prisma.bellSubscription.deleteMany({
        where: {
          subscriberId: followerId,
          targetUserId: followingId
        }
      });

      following = false;
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          followerId,
          followingId
        }
      });

      following = true;

      // Send notification to followed user
      const follower = await prisma.user.findUnique({
        where: { id: followerId },
        select: { username: true, name: true, avatarUrl: true }
      });

      await sendNotificationEvent({
        id: uuidv4(),
        type: 'FOLLOW',
        priority: 'LOW',
        actorId: followerId,
        actorName: follower?.name || follower?.username || 'Someone',
        actorAvatar: follower?.avatarUrl,
        targetId: followingId,
        targetType: 'USER',
        targetEntityId: followerId,
        title: 'New Follower',
        message: `${follower?.name || follower?.username} started following you`,
        timestamp: new Date().toISOString(),
        metadata: {
          profileUrl: `/users/${followerId}`,
        }
      });
    }

    res.json({
      success: true,
      following
    });
  } catch (error: any) {
    console.error('❌ Follow/Unfollow error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/follows/:userId/followers
 * Get user's followers
 */
router.get('/:userId/followers', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      followers: followers.map(f => f.follower)
    });
  } catch (error: any) {
    console.error('❌ Get followers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/follows/:userId/following
 * Get users that user is following
 */
router.get('/:userId/following', async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;

    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      following: following.map(f => f.following)
    });
  } catch (error: any) {
    console.error('❌ Get following error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/follows/:userId/bell
 * Toggle bell subscription for a user (must be following first)
 */
router.post('/:userId/bell', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.userId;
    const subscriberId = req.userId!;

    // Check if following
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: subscriberId,
          followingId: targetUserId
        }
      }
    });

    if (!follow) {
      res.status(400).json({ success: false, error: 'Must follow user first' });
      return;
    }

    // Check if bell subscription exists
    const existingBell = await prisma.bellSubscription.findUnique({
      where: {
        subscriberId_targetUserId: {
          subscriberId,
          targetUserId
        }
      }
    });

    let bellEnabled = false;

    if (existingBell) {
      // Delete to disable
      await prisma.bellSubscription.delete({
        where: { id: existingBell.id }
      });
      bellEnabled = false;
    } else {
      // Create new bell subscription
      await prisma.bellSubscription.create({
        data: {
          subscriberId,
          targetUserId,
        }
      });
      bellEnabled = true;
    }

    res.json({
      success: true,
      bellEnabled
    });
  } catch (error: any) {
    console.error('❌ Toggle bell error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as followRouter };
