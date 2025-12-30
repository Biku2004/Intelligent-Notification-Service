// Notification History API Service
// Provides REST endpoints to query notification history from PostgreSQL
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

/**
 * GET /api/notifications/:userId
 * Fetch user's notification history with pagination
 */
app.get('/api/notifications/:userId', async (req: Request, res: Response) => {
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
          isAggregated: true,
          aggregatedCount: true,
          title: true,
          message: true,
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
});

/**
 * GET /api/notifications/:userId/unread-count
 * Get unread notification count
 */
app.get('/api/notifications/:userId/unread-count', async (req: Request, res: Response) => {
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
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
app.patch('/api/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
});

/**
 * PATCH /api/notifications/:userId/read-all
 * Mark all notifications as read for a user
 */
app.patch('/api/notifications/:userId/read-all', async (req: Request, res: Response) => {
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
});

/**
 * GET /api/notifications/:userId/grouped
 * Get notifications grouped by type
 */
app.get('/api/notifications/:userId/grouped', async (req: Request, res: Response) => {
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
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
app.delete('/api/notifications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'healthy', 
      service: 'Notification History API',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    });
  }
});

/**
 * Start server
 */
const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');

    app.listen(PORT, () => {
      console.log(`🚀 Notification History API running on port ${PORT}`);
      console.log(`📚 API Documentation:`);
      console.log(`   GET    /api/notifications/:userId`);
      console.log(`   GET    /api/notifications/:userId/unread-count`);
      console.log(`   GET    /api/notifications/:userId/grouped`);
      console.log(`   PATCH  /api/notifications/:id/read`);
      console.log(`   PATCH  /api/notifications/:userId/read-all`);
      console.log(`   DELETE /api/notifications/:id`);
      console.log(`   GET    /health`);
    });
  } catch (error) {
    console.error('❌ Failed to start Notification History API:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, closing connections...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
