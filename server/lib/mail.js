import nodemailer from 'nodemailer';
import { config } from './config.js';

export const mailConfigured = () => !!(config.smtp.host && config.smtp.from);

export async function sendMail({ to, subject, text, attachments, replyTo }) {
  if (!mailConfigured()) {
    const e = new Error('Email sending is not set up. Add SMTP_HOST, SMTP_USER, SMTP_PASS and MAIL_FROM to your .env file, or use "Open in my email app" instead.');
    e.status = 400;
    throw e;
  }
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport.sendMail({ from: config.smtp.from, to, subject, text, attachments, replyTo });
}
