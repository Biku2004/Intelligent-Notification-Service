import { NotificationEvent } from '../../../shared/types';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Generate email template based on notification type
 */
export function generateEmailTemplate(event: NotificationEvent): EmailTemplate {
  const { type, actorName, actorAvatar, message, title, metadata } = event;

  // Base styles for email
  const styles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
      .content { background: #ffffff; padding: 30px; border: 1px solid #e1e8ed; border-top: none; }
      .footer { background: #f7f9fa; padding: 20px; text-align: center; color: #657786; font-size: 12px; border-radius: 0 0 10px 10px; }
      .actor { display: flex; align-items: center; margin-bottom: 20px; }
      .actor-avatar { width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; }
      .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px; }
      .notification-message { font-size: 16px; line-height: 1.5; color: #14171a; margin: 20px 0; }
    </style>
  `;

  switch (type) {
    case 'OTP':
      return {
        subject: 'Your One-Time Password',
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>🔐 Verification Code</h1>
            </div>
            <div class="content">
              <p class="notification-message">${message}</p>
              <p style="font-size: 14px; color: #657786;">This code will expire in 5 minutes.</p>
            </div>
            <div class="footer">
              <p>If you didn't request this code, please ignore this email.</p>
            </div>
          </div>
        `,
        text: `Verification Code\n\n${message}\n\nThis code will expire in 5 minutes.`,
      };

    case 'PASSWORD_RESET':
      return {
        subject: 'Reset Your Password',
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>🔑 Password Reset</h1>
            </div>
            <div class="content">
              <p class="notification-message">${message}</p>
              <a href="${metadata?.resetUrl || '#'}" class="button">Reset Password</a>
              <p style="font-size: 14px; color: #657786; margin-top: 20px;">This link will expire in 1 hour.</p>
            </div>
            <div class="footer">
              <p>If you didn't request this reset, please ignore this email.</p>
            </div>
          </div>
        `,
        text: `Password Reset\n\n${message}\n\nLink: ${metadata?.resetUrl || ''}\n\nThis link will expire in 1 hour.`,
      };

    case 'LIKE':
      return {
        subject: `${actorName} liked your post`,
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>❤️ New Like</h1>
            </div>
            <div class="content">
              <div class="actor">
                ${actorAvatar ? `<img src="${actorAvatar}" alt="${actorName}" class="actor-avatar">` : ''}
                <div>
                  <strong>${actorName}</strong> liked your post
                </div>
              </div>
              ${metadata?.postImage ? `<img src="${metadata.postImage}" alt="Post" style="max-width: 100%; border-radius: 8px; margin: 20px 0;">` : ''}
              <p class="notification-message">${message}</p>
              <a href="${metadata?.postUrl || '#'}" class="button">View Post</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have notifications enabled.</p>
            </div>
          </div>
        `,
        text: `${actorName} liked your post\n\n${message}\n\nView: ${metadata?.postUrl || ''}`,
      };

    case 'COMMENT':
    case 'COMMENT_REPLY':
      return {
        subject: `${actorName} commented on your post`,
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>💬 New Comment</h1>
            </div>
            <div class="content">
              <div class="actor">
                ${actorAvatar ? `<img src="${actorAvatar}" alt="${actorName}" class="actor-avatar">` : ''}
                <div>
                  <strong>${actorName}</strong> commented: "${message}"
                </div>
              </div>
              <a href="${metadata?.postUrl || '#'}" class="button">Reply</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have notifications enabled.</p>
            </div>
          </div>
        `,
        text: `${actorName} commented: "${message}"\n\nReply: ${metadata?.postUrl || ''}`,
      };

    case 'FOLLOW':
      return {
        subject: `${actorName} started following you`,
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>👥 New Follower</h1>
            </div>
            <div class="content">
              <div class="actor">
                ${actorAvatar ? `<img src="${actorAvatar}" alt="${actorName}" class="actor-avatar">` : ''}
                <div>
                  <strong>${actorName}</strong> started following you
                </div>
              </div>
              <p class="notification-message">${message}</p>
              <a href="${metadata?.profileUrl || '#'}" class="button">View Profile</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you have notifications enabled.</p>
            </div>
          </div>
        `,
        text: `${actorName} started following you\n\nView profile: ${metadata?.profileUrl || ''}`,
      };

    case 'MARKETING':
    case 'DIGEST':
      return {
        subject: title || 'Weekly Digest',
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>📧 ${title || 'Weekly Digest'}</h1>
            </div>
            <div class="content">
              <p class="notification-message">${message}</p>
              <a href="${metadata?.url || '#'}" class="button">Read More</a>
            </div>
            <div class="footer">
              <p><a href="${metadata?.unsubscribeUrl || '#'}">Unsubscribe</a> from marketing emails</p>
            </div>
          </div>
        `,
        text: `${title || 'Weekly Digest'}\n\n${message}\n\nRead more: ${metadata?.url || ''}`,
      };

    default:
      return {
        subject: title || 'New Notification',
        html: `
          ${styles}
          <div class="container">
            <div class="header">
              <h1>🔔 ${title || 'New Notification'}</h1>
            </div>
            <div class="content">
              <p class="notification-message">${message}</p>
            </div>
            <div class="footer">
              <p>You're receiving this because you have notifications enabled.</p>
            </div>
          </div>
        `,
        text: `${title || 'New Notification'}\n\n${message}`,
      };
  }
}
