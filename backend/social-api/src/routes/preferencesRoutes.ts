/**
 * Notification Preferences Routes
 * GET /api/preferences/:userId - Get user's notification preferences
 * PATCH /api/preferences/:userId - Update user's notification preferences
 */
import express, { Response } from 'express';
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * GET /api/preferences/:userId
 * Get user's notification preferences
 * Protected: user can only access their own preferences
 */
router.get('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;

        // IDOR protection: user can only access own preferences
        if (userId !== req.userId) {
            res.status(403).json({ success: false, error: 'Cannot access another user\'s preferences' });
            return;
        }

        const preferences = await prisma.notificationPreference.findUnique({
            where: { userId },
            select: {
                id: true,
                userId: true,
                emailEnabled: true,
                smsEnabled: true,
                pushEnabled: true,
                marketing: true,
                activity: true,
                social: true,
                dndEnabled: true,
                dndStartTime: true,
                dndEndTime: true,
            }
        });

        if (!preferences) {
            // Return defaults if preferences don't exist yet
            res.json({
                success: true,
                preferences: {
                    userId,
                    emailEnabled: true,
                    smsEnabled: false,
                    pushEnabled: true,
                    marketing: false,
                    activity: true,
                    social: true,
                    dndEnabled: false,
                    dndStartTime: null,
                    dndEndTime: null,
                }
            });
            return;
        }

        res.json({ success: true, preferences });
    } catch (error: any) {
        console.error('❌ Get preferences error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
    }
});

/**
 * PATCH /api/preferences/:userId
 * Update user's notification preferences
 * Protected: user can only update their own preferences
 */
router.patch('/:userId', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params;

        // IDOR protection
        if (userId !== req.userId) {
            res.status(403).json({ success: false, error: 'Cannot update another user\'s preferences' });
            return;
        }

        const {
            emailEnabled,
            smsEnabled,
            pushEnabled,
            marketing,
            activity,
            social,
            dndEnabled,
            dndStartTime,
            dndEndTime,
        } = req.body;

        // Build update data - only include fields that were sent
        const updateData: Record<string, any> = {};
        if (emailEnabled !== undefined) updateData.emailEnabled = emailEnabled;
        if (smsEnabled !== undefined) updateData.smsEnabled = smsEnabled;
        if (pushEnabled !== undefined) updateData.pushEnabled = pushEnabled;
        if (marketing !== undefined) updateData.marketing = marketing;
        if (activity !== undefined) updateData.activity = activity;
        if (social !== undefined) updateData.social = social;
        if (dndEnabled !== undefined) updateData.dndEnabled = dndEnabled;
        if (dndStartTime !== undefined) updateData.dndStartTime = dndStartTime;
        if (dndEndTime !== undefined) updateData.dndEndTime = dndEndTime;

        // Upsert: create if not exists, update if exists
        const preferences = await prisma.notificationPreference.upsert({
            where: { userId },
            update: updateData,
            create: {
                userId,
                emailEnabled: emailEnabled ?? true,
                smsEnabled: smsEnabled ?? false,
                pushEnabled: pushEnabled ?? true,
                marketing: marketing ?? false,
                activity: activity ?? true,
                social: social ?? true,
                dndEnabled: dndEnabled ?? false,
                dndStartTime: dndStartTime ?? null,
                dndEndTime: dndEndTime ?? null,
            },
            select: {
                id: true,
                userId: true,
                emailEnabled: true,
                smsEnabled: true,
                pushEnabled: true,
                marketing: true,
                activity: true,
                social: true,
                dndEnabled: true,
                dndStartTime: true,
                dndEndTime: true,
            }
        });

        res.json({ success: true, preferences });
    } catch (error: any) {
        console.error('❌ Update preferences error:', error);
        res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
});

export { router as preferencesRouter };
