/**
 * Kafka Fallback Service
 * When Kafka is unavailable, stores notification events in PostgreSQL
 * for later processing via a recovery job
 * 
 * RELIABILITY: P1 Fix #1 - Kafka fallback to database
 */
import { PrismaClient } from '../../../shared/prisma/generated/client';
import { NotificationEvent } from '../../../shared/types';

const prisma = new PrismaClient();

interface FallbackEvent {
    id: string;
    eventData: string;
    topic: string;
    priority: string;
    targetId: string;
    createdAt: Date;
    processed: boolean;
    retryCount: number;
    lastError?: string;
}

/**
 * Store a notification event in the fallback table when Kafka is unavailable
 */
export const storeInFallback = async (
    event: NotificationEvent,
    topic: string,
    error?: string
): Promise<boolean> => {
    try {
        await prisma.kafkaFallbackQueue.create({
            data: {
                id: event.id,
                eventData: JSON.stringify(event),
                topic,
                priority: event.priority,
                targetId: event.targetId,
                createdAt: new Date(),
                processed: false,
                retryCount: 0,
                lastError: error,
            }
        });

        console.log(`📦 Event ${event.id} stored in fallback queue (Kafka unavailable)`);
        return true;
    } catch (dbError) {
        console.error('❌ Failed to store event in fallback queue:', dbError);
        return false;
    }
};

/**
 * Retrieve unprocessed events from the fallback queue
 */
export const getUnprocessedEvents = async (limit: number = 100): Promise<FallbackEvent[]> => {
    try {
        const events = await prisma.kafkaFallbackQueue.findMany({
            where: {
                processed: false,
                retryCount: { lt: 5 } // Max 5 retries
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
        });

        return events as unknown as FallbackEvent[];
    } catch (error) {
        console.error('❌ Failed to fetch unprocessed events:', error);
        return [];
    }
};

/**
 * Mark an event as processed in the fallback queue
 */
export const markAsProcessed = async (eventId: string): Promise<void> => {
    try {
        await prisma.kafkaFallbackQueue.update({
            where: { id: eventId },
            data: {
                processed: true,
                processedAt: new Date()
            }
        });
    } catch (error) {
        console.error(`❌ Failed to mark event ${eventId} as processed:`, error);
    }
};

/**
 * Increment retry count for a failed event
 */
export const incrementRetryCount = async (eventId: string, error: string): Promise<void> => {
    try {
        await prisma.kafkaFallbackQueue.update({
            where: { id: eventId },
            data: {
                retryCount: { increment: 1 },
                lastError: error,
                lastRetryAt: new Date()
            }
        });
    } catch (updateError) {
        console.error(`❌ Failed to update retry count for ${eventId}:`, updateError);
    }
};

/**
 * Get fallback queue statistics
 */
export const getFallbackStats = async (): Promise<{
    pending: number;
    failed: number;
    processed: number;
}> => {
    try {
        const [pending, failed, processed] = await Promise.all([
            prisma.kafkaFallbackQueue.count({ where: { processed: false, retryCount: { lt: 5 } } }),
            prisma.kafkaFallbackQueue.count({ where: { processed: false, retryCount: { gte: 5 } } }),
            prisma.kafkaFallbackQueue.count({ where: { processed: true } })
        ]);

        return { pending, failed, processed };
    } catch (error) {
        console.error('❌ Failed to get fallback stats:', error);
        return { pending: 0, failed: 0, processed: 0 };
    }
};
