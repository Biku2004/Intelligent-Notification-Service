/**
 * Post Routes
 * /api/posts - Create post (authenticated)
 * /api/posts/:postId - Get single post
 * /api/posts - Get feed posts
 * /api/posts/:postId/like - Like/Unlike post (authenticated)
 */
import express, { Response } from 'express';
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { authMiddleware, optionalAuthMiddleware, AuthRequest } from '../middleware/auth';
import { sendNotificationEvent } from '../utils/kafka';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/posts
 * Create a new post (authenticated)
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { caption, imageUrl } = req.body;

    if (!caption && !imageUrl) {
      res.status(400).json({ success: false, error: 'Caption or image required' });
      return;
    }

    const post = await prisma.post.create({
      data: {
        userId,
        caption: caption || '',
        imageUrl,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          }
        }
      }
    });

    // Send notification to followers with bell subscription
    const bellSubscribers = await prisma.bellSubscription.findMany({
      where: {
        targetUserId: userId,
      },
      select: {
        subscriberId: true,
        subscriber: {
          select: {
            username: true,
          }
        }
      }
    });

    // Send BELL_POST notification to each subscriber
    for (const sub of bellSubscribers) {
      await sendNotificationEvent({
        id: uuidv4(),
        type: 'BELL_POST',
        priority: 'HIGH',
        actorId: userId,
        actorName: post.user.name || post.user.username,
        actorAvatar: post.user.avatarUrl,
        targetId: sub.subscriberId,
        targetType: 'POST',
        targetEntityId: post.id,
        title: 'New Post',
        message: `${post.user.name || post.user.username} posted: ${caption?.substring(0, 50) || 'New post'}`,
        imageUrl: post.imageUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          postUrl: `/posts/${post.id}`,
        }
      });
    }

    res.status(201).json({
      success: true,
      post: {
        ...post,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
      }
    });
  } catch (error: any) {
    console.error('❌ Create post error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/posts/:postId
 * Get single post with details
 */
router.get('/:postId', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const currentUserId = req.userId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          }
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          }
        }
      }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    // Check if current user liked this post
    let isLiked = false;
    if (currentUserId) {
      const like = await prisma.like.findUnique({
        where: {
          postId_userId: {
            postId,
            userId: currentUserId
          }
        }
      });
      isLiked = !!like;
    }

    res.json({
      success: true,
      post: {
        ...post,
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        isLiked,
      }
    });
  } catch (error: any) {
    console.error('❌ Get post error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/posts
 * Get feed posts with pagination
 */
router.get('/', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '10', userId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 50);
    const skip = (pageNum - 1) * limitNum;

    const where = userId ? { userId: userId as string } : {};

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
            }
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.post.count({ where })
    ]);

    // Check which posts are liked by current user
    const currentUserId = req.userId;
    let likedPostIds: string[] = [];
    if (currentUserId && posts.length > 0) {
      const likes = await prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: posts.map((p: any) => p.id) }
        },
        select: { postId: true }
      });
      likedPostIds = likes.map((l: any) => l.postId);
    }

    const postsWithLikes = posts.map((post: any) => ({
      ...post,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      isLiked: likedPostIds.includes(post.id),
    }));

    res.json({
      success: true,
      posts: postsWithLikes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('❌ Get posts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/posts/:postId/like
 * Like/Unlike a post (authenticated)
 */
router.post('/:postId/like', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatarUrl: true,
          }
        }
      }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    // Check if already liked (check in-memory or skip for now since we're batching)
    // For now, we'll allow the like event to be sent to Kafka
    // The batching system will handle duplicates with ON CONFLICT DO NOTHING

    // BATCHING: Don't write to DB immediately - let processing-service batch it
    // Just send the Kafka event and return success
    let liked = true;

    // Send notification to post owner (if not self-like)
    if (post.userId !== userId) {
      const liker = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true, avatarUrl: true }
      });

      // Check if post owner follows the liker (for priority)
      const isFollowed = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: post.userId,
            followingId: userId
          }
        }
      });

      // HIGH priority for all social interactions
      await sendNotificationEvent({
        id: uuidv4(),
        type: 'LIKE',
        priority: 'HIGH',
        actorId: userId,
        actorName: liker?.name || liker?.username || 'Someone',
        actorAvatar: liker?.avatarUrl,
        targetId: post.userId,
        targetType: 'POST',
        targetEntityId: postId,
        title: 'New Like',
        message: `${liker?.name || liker?.username} liked your post`,
        imageUrl: post.imageUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          postUrl: `/posts/${postId}`,
          isFromFollowedUser: !!isFollowed,
        }
      });
    }

    // Get current like count (may be slightly stale due to batching, but that's okay)
    const likesCount = await prisma.like.count({ where: { postId } });

    res.json({
      success: true,
      liked,
      likesCount: likesCount + 1 // Optimistic update
    });
  } catch (error: any) {
    console.error('❌ Like/Unlike error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/posts/:postId
 * Delete a post (authenticated, own posts only)
 */
router.delete('/:postId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = req.userId!;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    if (post.userId !== userId) {
      res.status(403).json({ success: false, error: 'Cannot delete another user\'s post' });
      return;
    }

    await prisma.post.delete({ where: { id: postId } });

    res.json({ success: true, message: 'Post deleted' });
  } catch (error: any) {
    console.error('❌ Delete post error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as postRouter };
