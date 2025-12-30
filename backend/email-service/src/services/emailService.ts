import { sgMail, FROM_EMAIL, FROM_NAME } from '../config/sendgrid';
import { NotificationEvent } from '../../../shared/types';
import { generateEmailTemplate } from '../templates/emailTemplates';

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email notification using SendGrid
 */
export async function sendEmail(
  event: NotificationEvent,
  recipientEmail: string
): Promise<SendEmailResult> {
  try {
    const isDryRun = !process.env.SENDGRID_API_KEY;

    if (isDryRun) {
      console.log('📧 [DRY-RUN] Email would be sent:');
      console.log(`   To: ${recipientEmail}`);
      console.log(`   Type: ${event.type}`);
      console.log(`   Message: ${event.message}`);
      return { success: true, messageId: 'dry-run-' + Date.now() };
    }

    const template = generateEmailTemplate(event);

    const msg = {
      to: recipientEmail,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject: template.subject,
      text: template.text,
      html: template.html,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
    };

    const [response] = await sgMail.send(msg);

    console.log(`✅ Email sent to ${recipientEmail}: ${event.type}`);
    
    return {
      success: true,
      messageId: response.headers['x-message-id'] || 'unknown',
    };
  } catch (error: any) {
    console.error('❌ Email send error:', error.response?.body || error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get user email from user ID (mock implementation)
 * TODO: Replace with actual database lookup
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  // Mock implementation - in production, query from PostgreSQL User table
  const mockEmails: Record<string, string> = {
    'user_123': 'user123@example.com',
    'user_456': 'user456@example.com',
  };

  return mockEmails[userId] || null;
}
