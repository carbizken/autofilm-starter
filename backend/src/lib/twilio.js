import twilio from 'twilio';

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
}
if (!process.env.TWILIO_PHONE_NUMBER) {
  throw new Error('Missing TWILIO_PHONE_NUMBER');
}

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
