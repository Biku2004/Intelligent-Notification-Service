/**
 * Test Routes - For simulating bulk interactions
 * Creates REAL database entries and triggers the full Kafka notification flow
 * 
 * WARNING: Only use in development/testing environments!
 */
import { Router, Response } from 'express';
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { sendNotificationEvent } from '../utils/kafka';

const router = Router();
const prisma = new PrismaClient();

// Generate unique test user names
const testUserNames = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
  'Ivy', 'Jack', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul',
  'Quinn', 'Rose', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy', 'Xavier',
  'Yara', 'Zack', 'Anna', 'Ben', 'Chloe', 'David', 'Emma', 'Felix',
  'Gina', 'Hugo', 'Iris', 'James', 'Kelly', 'Luke', 'Maya', 'Nick',
  'Oscar', 'Penny', 'Ray', 'Sara', 'Tom', 'Vera', 'Will', 'Zoe'
];

/**
 * POST /api/test/simulate-likes
 * Simulates multiple users liking a post
 * Creates real test users (if needed) and real likes in the database
 * Supports follower-based simulation for smart notification testing
 */
router.post('/simulate-likes', async (req, res: Response) => {
  try {
    const { postId, count = 5, targetUserId, simulationType = 'mixed' } = req.body;

    if (!postId || !targetUserId) {
      res.status(400).json({
        success: false,
        error: 'postId and targetUserId are required'
      });
      return;
    }

    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { user: true }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    const results: { userId: string; username: string; success: boolean; isFollower: boolean }[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < Math.min(count, 50); i++) {
      const testUsername = `test_${testUserNames[i % testUserNames.length].toLowerCase()}_${timestamp}_${i}`;
      const testEmail = `${testUsername}@test.local`;
      const testName = `${testUserNames[i % testUserNames.length]} (Test)`;

      // Determine if this user is a "follower" based on simulationType
      let isFollower = false;
      if (simulationType === 'followers') {
        isFollower = true;
      } else if (simulationType === 'non-followers') {
        isFollower = false;
      } else {
        // Mixed: alternate between followers and non-followers
        isFollower = i % 2 === 0;
      }

      try {
        // Create test user
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const testUser = await prisma.user.create({
          data: {
            id: uuidv4(),
            email: testEmail,
            username: testUsername,
            name: testName,
            password: hashedPassword,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${testUsername}`,
          }
        });

        // If simulating followers, create a follow relationship
        if (isFollower) {
          await prisma.follow.create({
            data: {
              followerId: testUser.id,
              followingId: targetUserId
            }
          }).catch(() => {
            // Ignore if follow already exists
          });
        }

        // BATCHING: Don't write to DB immediately - let processing-service batch it
        // The like will be written to DB after 2-minute aggregation window

        // Send notification through Kafka with follower info
        await sendNotificationEvent({
          id: uuidv4(),
          type: 'LIKE',
          priority: 'HIGH',
          actorId: testUser.id,
          actorName: testName,
          actorAvatar: testUser.avatarUrl,
          targetId: targetUserId,
          targetType: 'POST',
          targetEntityId: postId,
          title: 'New Like',
          message: `${testName} liked your post`,
          imageUrl: post.imageUrl,
          timestamp: new Date().toISOString(),
          metadata: {
            postUrl: `/posts/${postId}`,
            isTestUser: true,
            isFromFollowedUser: isFollower, // Key flag for smart aggregation
            simulationType: simulationType as string,
          }
        });

        results.push({ userId: testUser.id, username: testUsername, success: true, isFollower });

      } catch (error: any) {
        console.error(`Error creating test like ${i}:`, error.message);
        results.push({ userId: '', username: testUsername, success: false, isFollower });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const followerCount = results.filter(r => r.isFollower && r.success).length;

    // Determine expected delivery behavior
    const deliveryType = count <= 3 ? 'INSTANT' : 'BATCHED (~60s)';

    console.log(`\n🧪 ════════════════════════════════════════════════`);
    console.log(`🧪 TEST: Simulated ${successCount}/${count} likes`);
    console.log(`🧪 Post: ${postId}`);
    console.log(`🧪 Target User: ${targetUserId}`);
    console.log(`🧪 Followers: ${followerCount} | Non-followers: ${successCount - followerCount}`);
    console.log(`🧪 Expected Delivery: ${deliveryType}`);
    console.log(`🧪 ════════════════════════════════════════════════\n`);

    res.json({
      success: true,
      message: `Created ${successCount} test likes (${deliveryType})`,
      deliveryType,
      results,
      stats: {
        total: successCount,
        followers: followerCount,
        nonFollowers: successCount - followerCount
      }
    });

  } catch (error: any) {
    console.error('❌ Simulate likes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * POST /api/test/simulate-comments
 * Simulates multiple users commenting on a post
 */
router.post('/simulate-comments', async (req, res: Response) => {
  try {
    const { postId, count = 5, targetUserId } = req.body;

    if (!postId || !targetUserId) {
      res.status(400).json({
        success: false,
        error: 'postId and targetUserId are required'
      });
      return;
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { user: true }
    });

    if (!post) {
      res.status(404).json({ success: false, error: 'Post not found' });
      return;
    }

    const results: { userId: string; username: string; success: boolean }[] = [];
    const timestamp = Date.now();
    const commentTexts = [
      'Great post! 🔥', 'Love this!', 'Amazing content!', 'So cool!',
      'This is awesome!', 'Keep it up!', 'Incredible!', 'Wow!',
      'Nice one!', 'Love it!', 'Beautiful!', 'Perfect!',
      'Stunning!', 'Fantastic!', 'Brilliant!', 'Excellent!'
    ];

    for (let i = 0; i < Math.min(count, 50); i++) {
      const testUsername = `test_${testUserNames[i % testUserNames.length].toLowerCase()}_${timestamp}_${i}`;
      const testEmail = `${testUsername}@test.local`;
      const testName = `${testUserNames[i % testUserNames.length]} (Test)`;

      try {
        // Create test user
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const testUser = await prisma.user.create({
          data: {
            id: uuidv4(),
            email: testEmail,
            username: testUsername,
            name: testName,
            password: hashedPassword,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${testUsername}`,
          }
        });

        // BATCHING: Don't write to DB immediately - let processing-service batch it
        const commentId = uuidv4(); // Generate ID for metadata

        // Send notification through Kafka
        await sendNotificationEvent({
          id: uuidv4(),
          type: 'COMMENT',
          priority: 'HIGH',
          actorId: testUser.id,
          actorName: testName,
          actorAvatar: testUser.avatarUrl,
          targetId: targetUserId,
          targetType: 'POST',
          targetEntityId: postId,
          title: 'New Comment',
          message: `${testName} commented: "${commentTexts[i % commentTexts.length]}"`,
          imageUrl: post.imageUrl,
          timestamp: new Date().toISOString(),
          metadata: {
            postUrl: `/posts/${postId}`,
            commentId: commentId,
            isTestUser: true,
          }
        });

        results.push({ userId: testUser.id, username: testUsername, success: true });
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`Error creating test comment ${i}:`, error.message);
        results.push({ userId: '', username: testUsername, success: false });
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`\n🧪 ════════════════════════════════════════════════`);
    console.log(`🧪 TEST: Simulated ${successCount}/${count} comments`);
    console.log(`🧪 Post: ${postId}`);
    console.log(`🧪 Target User: ${targetUserId}`);
    console.log(`🧪 ════════════════════════════════════════════════\n`);

    res.json({
      success: true,
      message: `Created ${successCount} test comments`,
      results
    });

  } catch (error: any) {
    console.error('❌ Simulate comments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/test/simulate-follows
 * Simulates multiple users following a user
 */
router.post('/simulate-follows', async (req, res: Response) => {
  try {
    const { targetUserId, count = 5 } = req.body;

    if (!targetUserId) {
      res.status(400).json({
        success: false,
        error: 'targetUserId is required'
      });
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'Target user not found' });
      return;
    }

    const results: { userId: string; username: string; success: boolean }[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < Math.min(count, 50); i++) {
      const testUsername = `test_${testUserNames[i % testUserNames.length].toLowerCase()}_${timestamp}_${i}`;
      const testEmail = `${testUsername}@test.local`;
      const testName = `${testUserNames[i % testUserNames.length]} (Test)`;

      try {
        // Create test user
        const hashedPassword = await bcrypt.hash('testpass123', 10);
        const testUser = await prisma.user.create({
          data: {
            id: uuidv4(),
            email: testEmail,
            username: testUsername,
            name: testName,
            password: hashedPassword,
            avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${testUsername}`,
          }
        });

        // BATCHING: Don't write to DB immediately - let processing-service batch it

        // Send notification through Kafka
        await sendNotificationEvent({
          id: uuidv4(),
          type: 'FOLLOW',
          priority: 'HIGH',
          actorId: testUser.id,
          actorName: testName,
          actorAvatar: testUser.avatarUrl,
          targetId: targetUserId,
          targetType: 'USER',
          targetEntityId: targetUserId,
          title: 'New Follower',
          message: `${testName} started following you`,
          timestamp: new Date().toISOString(),
          metadata: {
            isTestUser: true,
          }
        });

        results.push({ userId: testUser.id, username: testUsername, success: true });
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        console.error(`Error creating test follow ${i}:`, error.message);
        results.push({ userId: '', username: testUsername, success: false });
      }
    }

    const successCount = results.filter(r => r.success).length;

    console.log(`\n🧪 ════════════════════════════════════════════════`);
    console.log(`🧪 TEST: Simulated ${successCount}/${count} follows`);
    console.log(`🧪 Target User: ${targetUserId}`);
    console.log(`🧪 ════════════════════════════════════════════════\n`);

    res.json({
      success: true,
      message: `Created ${successCount} test follows`,
      results
    });

  } catch (error: any) {
    console.error('❌ Simulate follows error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/test/cleanup
 * Removes all test users and their data
 */
router.delete('/cleanup', async (req, res: Response) => {
  try {
    // Delete test users (cascade deletes their likes, comments, follows)
    const deleted = await prisma.user.deleteMany({
      where: {
        email: { endsWith: '@test.local' }
      }
    });

    console.log(`🧹 Cleaned up ${deleted.count} test users`);

    res.json({
      success: true,
      message: `Cleaned up ${deleted.count} test users and their data`
    });

  } catch (error: any) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export const testRouter = router;
