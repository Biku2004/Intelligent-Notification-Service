import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'notifications@yourdomain.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Notification System';

if (!SENDGRID_API_KEY) {
  console.warn('⚠️  SENDGRID_API_KEY not configured. Email service will run in dry-run mode.');
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
}

export { sgMail, FROM_EMAIL, FROM_NAME };
