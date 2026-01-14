"use strict";
/**
 * Retry Handler with Exponential Backoff
 * Handles failed notification deliveries with intelligent retry logic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RETRY_CONFIG = void 0;
exports.calculateBackoff = calculateBackoff;
exports.sleep = sleep;
exports.retryWithBackoff = retryWithBackoff;
exports.isRetryableError = isRetryableError;
exports.retryIfRetryable = retryIfRetryable;
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 60000, // 1 minute
    backoffMultiplier: 2, // Exponential: 1s, 2s, 4s, 8s...
};
exports.DEFAULT_RETRY_CONFIG = DEFAULT_RETRY_CONFIG;
/**
 * Calculate delay for next retry attempt with exponential backoff
 */
function calculateBackoff(attemptNumber, config = DEFAULT_RETRY_CONFIG) {
    const delay = Math.min(config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber), config.maxDelayMs);
    // Add jitter (±10%) to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
}
/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, context, config = DEFAULT_RETRY_CONFIG) {
    let lastError;
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === config.maxRetries) {
                console.error(`❌ ${context} failed after ${config.maxRetries} retries`);
                throw error;
            }
            const delay = calculateBackoff(attempt, config);
            console.log(`⏳ ${context} failed (attempt ${attempt + 1}/${config.maxRetries}), retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    throw lastError;
}
/**
 * Check if error is retryable
 */
function isRetryableError(error) {
    // Network errors
    if (error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
        return true;
    }
    // HTTP status codes that should be retried
    if (error.response?.status === 429 || // Rate limit
        error.response?.status === 503 || // Service unavailable
        error.response?.status === 504) { // Gateway timeout
        return true;
    }
    // Twilio specific errors
    if (error.code === 20429) { // Twilio rate limit
        return true;
    }
    // SendGrid specific errors
    if (error.code === 429 || error.code === 'ETIMEDOUT') {
        return true;
    }
    return false;
}
/**
 * Retry only if error is retryable
 */
async function retryIfRetryable(fn, context, config) {
    try {
        return await retryWithBackoff(fn, context, config);
    }
    catch (error) {
        if (!isRetryableError(error)) {
            console.log(`⚠️  ${context} failed with non-retryable error, skipping retries`);
            throw error;
        }
        throw error;
    }
}
