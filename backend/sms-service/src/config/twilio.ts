import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: twilio.Twilio | null = null;

if (!ACCOUNT_SID || !AUTH_TOKEN) {
  console.warn('⚠️  Twilio credentials not configured. SMS service will run in dry-run mode.');
} else {
  twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);
  console.log('✅ Twilio configured');
}

export { twilioClient, PHONE_NUMBER };
