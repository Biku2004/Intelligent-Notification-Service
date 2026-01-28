// Notification History API Service
// Provides REST endpoints to query notification history from PostgreSQL
//
// SECURITY: P0 Fix #4 - All endpoints now require authentication
// Users can only access their own notifications (IDOR protection)
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '../../shared/prisma/generated/client';
import { authMiddleware, authorizeUser, AuthRequest } from './middleware/auth';

import { tracingMiddleware } from '../../shared/middleware/tracing';
import { Logger } from '../../shared/utils/logger';
import adminRoutes from './routes/adminRoutes';

import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

const app = express();
const PORT = process.env.NOTIFICATION_API_PORT || 3001;
// Use shared client
const prisma = new PrismaClient();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(tracingMiddleware);

// Request logging
app.use((req, res, next) => {
  Logger.info(`Incoming ${req.method} request to ${req.url}`);
  next();
});

// Admin Routes
app.use('/api/admin', adminRoutes);

// Health check - no auth required
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      service: 'notification-api',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'notification-api',
      database: 'disconnected'
    });
  }
});

/**
 * GET /api/notifications/:userId
 * Fetch user's notification history with pagination
 * PROTECTED: Requires auth + user can only access own notifications
 */
app.get(
  '/api/notifications/:userId',
  authMiddleware,
  authorizeUser('userId'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const {
        page = '1',
        limit = '20',
        unreadOnly = 'false',
        priority
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100); // Max 100
      const skip = (pageNum - 1) * limitNum;

      // Build filter
      const where: {
        userId: string;
        isRead?: boolean;
        priority?: string;
      } = { userId };

      if (unreadOnly === 'true') {
        where.isRead = false;
      }

      if (priority && typeof priority === 'string') {
        where.priority = priority;
      }

      // Fetch notifications
      const [notifications, total] = await Promise.all([
        prisma.notificationHistory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
          select: {
            id: true,
            userId: true,
            type: true,
            priority: true,
            actorId: true,
            actorName: true,
            actorAvatar: true,
            isAggregated: true,
            aggregatedCount: true,
            title: true,
            message: true,
            imageUrl: true,
            targetType: true,
            targetId: true,
            isRead: true,
            channels: true,
            metadata: true,
            createdAt: true,
          },
        }),
        prisma.notificationHistory.count({ where }),
      ]);

      res.json({
        success: true,
        notifications,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasMore: skip + limitNum < total,
        },
      });

    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
  }
);

/**
 * GET /api/notifications/:userId/unread-count
 * Get unread notification count
 * PROTECTED: Requires auth + user can only access own count
 */
app.get(
  '/api/notifications/:userId/unread-count',
  authMiddleware,
  authorizeUser('userId'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const [total, byCritical, byHigh, byLow] = await Promise.all([
        prisma.notificationHistory.count({
          where: { userId, isRead: false },
        }),
        prisma.notificationHistory.count({
          where: { userId, isRead: false, priority: 'CRITICAL' },
        }),
        prisma.notificationHistory.count({
          where: { userId, isRead: false, priority: 'HIGH' },
        }),
        prisma.notificationHistory.count({
          where: { userId, isRead: false, priority: 'LOW' },
        }),
      ]);

      res.json({
        success: true,
        count: total,
        breakdown: {
          critical: byCritical,
          high: byHigh,
          low: byLow,
        },
      });

    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch unread count'
      });
    }
  }
);

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 * PROTECTED: Requires auth + verifies notification belongs to user
 */
app.patch(
  '/api/notifications/:id/read',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // First verify the notification belongs to this user
      const existingNotification = await prisma.notificationHistory.findUnique({
        where: { id },
        select: { userId: true }
      });

      if (!existingNotification) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      if (existingNotification.userId !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden: Cannot modify another user\'s notification' });
        return;
      }

      const notification = await prisma.notificationHistory.update({
        where: { id },
        data: {
          isRead: true,
        },
      });

      res.json({
        success: true,
        notification,
      });

    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  }
);

/**
 * PATCH /api/notifications/:userId/read-all
 * Mark all notifications as read for a user
 * PROTECTED: Requires auth + user can only mark own notifications
 */
app.patch(
  '/api/notifications/:userId/read-all',
  authMiddleware,
  authorizeUser('userId'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const result = await prisma.notificationHistory.updateMany({
        where: { userId, isRead: false },
        data: {
          isRead: true,
        },
      });

      res.json({
        success: true,
        updatedCount: result.count,
      });

    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all as read'
      });
    }
  }
);

/**
 * GET /api/notifications/:userId/grouped
 * Get notifications grouped by type
 * PROTECTED: Requires auth + user can only access own notifications
 */
app.get(
  '/api/notifications/:userId/grouped',
  authMiddleware,
  authorizeUser('userId'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const notifications = await prisma.notificationHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      type NotificationItem = typeof notifications[0];
      type GroupedType = Record<string, NotificationItem[]>;

      // Group by type
      const grouped: GroupedType = notifications.reduce(
        (acc: GroupedType, notif: NotificationItem) => {
          if (!acc[notif.type]) {
            acc[notif.type] = [];
          }
          acc[notif.type].push(notif);
          return acc;
        },
        {} as GroupedType
      );

      // Calculate stats
      const stats = (Object.entries(grouped) as [string, NotificationItem[]][]).map(
        ([type, items]) => ({
          type,
          count: items.length,
          unread: items.filter((n) => !n.isRead).length,
          latest: items[0]?.createdAt,
        })
      );

      res.json({
        success: true,
        grouped,
        stats,
      });

    } catch (error) {
      console.error('❌ Error fetching grouped notifications:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch grouped notifications'
      });
    }
  }
);

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 * PROTECTED: Requires auth + verifies notification belongs to user
 */
app.delete(
  '/api/notifications/:id',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // First verify the notification belongs to this user
      const existingNotification = await prisma.notificationHistory.findUnique({
        where: { id },
        select: { userId: true }
      });

      if (!existingNotification) {
        res.status(404).json({ success: false, error: 'Notification not found' });
        return;
      }

      if (existingNotification.userId !== userId) {
        res.status(403).json({ success: false, error: 'Forbidden: Cannot delete another user\'s notification' });
        return;
      }

      await prisma.notificationHistory.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Notification deleted',
      });

    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification'
      });
    }
  }
);

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: any) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  Logger.info(`🔔 Notification API running on port ${PORT}`);
  Logger.info(`🔐 All endpoints are protected with JWT authentication`);
  Logger.info(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
