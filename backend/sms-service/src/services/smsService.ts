import { twilioClient, PHONE_NUMBER } from '../config/twilio';
import { NotificationEvent } from '../../../shared/types';

interface SendSMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

/**
 * Generate SMS message text based on notification type
 */
function generateSMSText(event: NotificationEvent): string {
  const { type, actorName, message = '' } = event;

  switch (type) {
    case 'OTP':
      return message || 'Your verification code has been sent'; // Already formatted: "Your OTP is 123456"

    case 'PASSWORD_RESET':
      return `Reset your password: ${event.metadata?.resetUrl || 'Check your email'}`;

    case 'SECURITY_ALERT':
      return `🔐 Security Alert: ${message || 'Please check your account'}`;

    case 'LIKE':
      return `${actorName || 'Someone'} liked your post`;

    case 'COMMENT':
      return `${actorName || 'Someone'}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`;

    case 'FOLLOW':
      return `${actorName || 'Someone'} started following you`;

    default:
      return message.substring(0, 160); // SMS character limit
  }
}

/**
 * Send SMS notification using Twilio
 */
export async function sendSMS(
  event: NotificationEvent,
  recipientPhone: string
): Promise<SendSMSResult> {
  try {
    const isDryRun = !twilioClient;

    const smsText = generateSMSText(event);

    if (isDryRun) {
      console.log('📱 [DRY-RUN] SMS would be sent:');
      console.log(`   To: ${recipientPhone}`);
      console.log(`   Type: ${event.type}`);
      console.log(`   Message: ${smsText}`);
      return { success: true, messageSid: 'dry-run-' + Date.now() };
    }

    if (!PHONE_NUMBER) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    const result = await twilioClient!.messages.create({
      body: smsText,
      from: PHONE_NUMBER,
      to: recipientPhone,
    });

    console.log(`✅ SMS sent to ${recipientPhone}: ${event.type}`);
    
    return {
      success: true,
      messageSid: result.sid,
    };
  } catch (error: any) {
    console.error('❌ SMS send error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user phone number from user ID (mock implementation)
 * TODO: Replace with actual database lookup
 */
export async function getUserPhone(userId: string): Promise<string | null> {
  // Mock implementation - in production, query from PostgreSQL User table
  const mockPhones: Record<string, string> = {
    'user_123': '+1234567890',
    'user_456': '+0987654321',
  };

  return mockPhones[userId] || null;
}
