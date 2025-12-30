/**
 * Comment Routes
 * /api/comments - Add comment to post (authenticated)
 * /api/comments/:commentId - Delete comment (authenticated)
 * /api/comments/:commentId/reply - Reply to comment (authenticated)
 */
import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendNotificationEvent } from '../utils/kafka';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/comments
 * Add comment to a post
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { postId, content, gifUrl } = req.body;

    if (!postId || !content) {
      res.status(400).json({ success: false, error: 'PostId and content required' });
      return;
    }

    // Check if post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: { id: true, username: true, name: true }
        }
      }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content,
      },
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

    // Send notification to post owner (if not self-comment)
    if (post.userId !== userId) {
      const commenter = comment.user;
      
      await sendNotificationEvent({
        id: uuidv4(),
        type: 'COMMENT',
        priority: 'HIGH',
        actorId: userId,
        actorName: commenter.name || commenter.username,
        actorAvatar: commenter.avatarUrl,
        targetId: post.userId,
        targetType: 'POST',
        targetEntityId: postId,
        title: 'New Comment',
        message: content.substring(0, 100),
        imageUrl: post.imageUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          postUrl: `/posts/${postId}`,
          commentId: comment.id,
        }
      });
    }

    res.status(201).json({
      success: true,
      comment
    });
  } catch (error: any) {
    console.error('❌ Add comment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/comments/:commentId/reply
 * Reply to a comment
 */
router.post('/:commentId/reply', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { commentId } = req.params;
    const { content, gifUrl } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content required' });
      return;
    }

    // Check if parent comment exists
    const parentComment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          select: {
            id: true,
            imageUrl: true,
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          }
        }
      }
    });

    if (!parentComment) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    const reply = await prisma.comment.create({
      data: {
        postId: parentComment.postId,
        userId,
        content,
        parentId: commentId,
      },
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

    // Send notification to parent comment owner (if not self-reply)
    if (parentComment.userId !== userId) {
      const replier = reply.user;
      
      await sendNotificationEvent({
        id: uuidv4(),
        type: 'COMMENT_REPLY',
        priority: 'HIGH',
        actorId: userId,
        actorName: replier.name || replier.username,
        actorAvatar: replier.avatarUrl,
        targetId: parentComment.userId,
        targetType: 'COMMENT',
        targetEntityId: commentId,
        title: 'New Reply',
        message: content.substring(0, 100),
        imageUrl: parentComment.post.imageUrl,
        timestamp: new Date().toISOString(),
        metadata: {
          postUrl: `/posts/${parentComment.postId}`,
          commentId: reply.id,
        }
      });
    }

    res.status(201).json({
      success: true,
      comment: reply
    });
  } catch (error: any) {
    console.error('❌ Reply comment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/comments
 * Get comments for a post
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { postId } = req.query;

    if (!postId || typeof postId !== 'string') {
      res.status(400).json({ success: false, error: 'PostId required' });
      return;
    }

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentId: null, // Top-level comments only
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
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatarUrl: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      comments
    });
  } catch (error: any) {
    console.error('❌ Get comments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/comments/:commentId
 * Delete a comment (authenticated, own comments only)
 */
router.delete('/:commentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true }
    });

    if (!comment) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    if (comment.userId !== userId) {
      res.status(403).json({ success: false, error: 'Cannot delete another user\'s comment' });
      return;
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error: any) {
    console.error('❌ Delete comment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as commentRouter };
