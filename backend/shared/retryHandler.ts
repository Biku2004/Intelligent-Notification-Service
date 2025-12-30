/**
 * Retry Handler with Exponential Backoff
 * Handles failed notification deliveries with intelligent retry logic
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,      // 1 second
  maxDelayMs: 60000,         // 1 minute
  backoffMultiplier: 2,      // Exponential: 1s, 2s, 4s, 8s...
};

/**
 * Calculate delay for next retry attempt with exponential backoff
 */
export function calculateBackoff(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptNumber),
    config.maxDelayMs
  );
  
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
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
export function isRetryableError(error: any): boolean {
  // Network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND') {
    return true;
  }
  
  // HTTP status codes that should be retried
  if (error.response?.status === 429 ||  // Rate limit
      error.response?.status === 503 ||  // Service unavailable
      error.response?.status === 504) {  // Gateway timeout
    return true;
  }
  
  // Twilio specific errors
  if (error.code === 20429) {  // Twilio rate limit
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
export async function retryIfRetryable<T>(
  fn: () => Promise<T>,
  context: string,
  config?: RetryConfig
): Promise<T> {
  try {
    return await retryWithBackoff(fn, context, config);
  } catch (error: any) {
    if (!isRetryableError(error)) {
      console.log(`⚠️  ${context} failed with non-retryable error, skipping retries`);
      throw error;
    }
    throw error;
  }
}

export { RetryConfig, DEFAULT_RETRY_CONFIG };
