"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchWriteLikes = batchWriteLikes;
exports.batchWriteComments = batchWriteComments;
exports.batchWriteFollows = batchWriteFollows;
exports.executeBatchWrite = executeBatchWrite;
/**
 * Batch Write Service
 * Handles batched database writes for likes, comments, follows to reduce DB load
 */
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
// Separate Prisma client for social database (using raw SQL to avoid schema conflicts)
const socialDb = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.SOCIAL_DATABASE_URL,
        },
    },
});
/**
 * Batch write likes to database using raw SQL for performance
 * Writes all likes in one transaction
 */
async function batchWriteLikes(events) {
    const result = { success: true, written: 0, errors: 0 };
    try {
        const postId = events[0]?.targetEntityId;
        if (!postId) {
            console.error('❌ No targetEntityId found in events');
            return { success: false, written: 0, errors: events.length };
        }
        console.log(`\n💾 ════════════════════════════════════════════════`);
        console.log(`💾 BATCH WRITE: ${events.length} likes to DB`);
        console.log(`💾 Post: ${postId}`);
        // Build bulk INSERT with ON CONFLICT DO NOTHING (skip duplicates)
        // IMPORTANT: we generate UUIDs in Node to avoid requiring DB extensions.
        const values = events
            .map((event) => {
            const id = (0, uuid_1.v4)();
            // IDs here are UUIDs from our system; they contain no quotes, but we keep the format strict.
            return `('${id}', '${postId}', '${event.actorId}', NOW())`;
        })
            .join(',');
        const query = `
      INSERT INTO "Like" ("id", "postId", "userId", "createdAt")
      VALUES ${values}
      ON CONFLICT ("postId", "userId") DO NOTHING
    `;
        const affectedRows = await socialDb.$executeRawUnsafe(query);
        result.written = affectedRows;
        console.log(`💾 ✅ Written: ${result.written} likes (${events.length - result.written} duplicates skipped)`);
        console.log(`💾 ════════════════════════════════════════════════\n`);
        return result;
    }
    catch (error) {
        console.error('❌ Batch write likes error:', error.message);
        result.success = false;
        result.errors = events.length;
        return result;
    }
}
/**
 * Batch write comments to database using raw SQL
 */
async function batchWriteComments(events) {
    const result = { success: true, written: 0, errors: 0 };
    try {
        const postId = events[0]?.targetEntityId;
        if (!postId) {
            return { success: false, written: 0, errors: events.length };
        }
        console.log(`\n💾 BATCH WRITE: ${events.length} comments to DB`);
        // Build bulk INSERT (generate IDs in Node; escape content)
        const values = events
            .map((event) => {
            const id = (0, uuid_1.v4)();
            const content = (event.message || 'Nice post!').replace(/'/g, "''");
            return `('${id}', '${event.actorId}', '${postId}', '${content}', NOW(), NOW())`;
        })
            .join(',');
        const query = `
      INSERT INTO "Comment" ("id", "userId", "postId", content, "createdAt", "updatedAt")
      VALUES ${values}
    `;
        const affectedRows = await socialDb.$executeRawUnsafe(query);
        result.written = affectedRows;
        console.log(`💾 ✅ Written: ${result.written} comments\n`);
        return result;
    }
    catch (error) {
        console.error('❌ Batch write comments error:', error.message);
        result.success = false;
        result.errors = events.length;
        return result;
    }
}
/**
 * Batch write follows to database using raw SQL
 */
async function batchWriteFollows(events) {
    const result = { success: true, written: 0, errors: 0 };
    try {
        const targetUserId = events[0]?.targetId;
        if (!targetUserId) {
            return { success: false, written: 0, errors: events.length };
        }
        console.log(`\n💾 BATCH WRITE: ${events.length} follows to DB`);
        const values = events
            .map((event) => {
            const id = (0, uuid_1.v4)();
            return `('${id}', '${event.actorId}', '${targetUserId}', NOW())`;
        })
            .join(',');
        const query = `
      INSERT INTO "Follow" ("id", "followerId", "followingId", "createdAt")
      VALUES ${values}
      ON CONFLICT ("followerId", "followingId") DO NOTHING
    `;
        const affectedRows = await socialDb.$executeRawUnsafe(query);
        result.written = affectedRows;
        console.log(`💾 ✅ Written: ${result.written} follows\n`);
        return result;
    }
    catch (error) {
        console.error('❌ Batch write follows error:', error.message);
        result.success = false;
        result.errors = events.length;
        return result;
    }
}
/**
 * Main batch write handler - routes to correct write function
 */
async function executeBatchWrite(events) {
    if (events.length === 0) {
        return { success: true, written: 0, errors: 0 };
    }
    const eventType = events[0].type;
    switch (eventType) {
        case 'LIKE':
            return batchWriteLikes(events);
        case 'COMMENT':
        case 'COMMENT_REPLY':
            return batchWriteComments(events);
        case 'FOLLOW':
            return batchWriteFollows(events);
        default:
            console.log(`⚠️ No batch write handler for type: ${eventType}`);
            return { success: true, written: 0, errors: 0 };
    }
}
