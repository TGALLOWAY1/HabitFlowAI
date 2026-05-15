/**
 * Transactional email via Resend.
 *
 * When `RESEND_API_KEY` is unset (e.g. dev / tests / preview), the helper logs
 * the message to the server console instead of throwing — so the password
 * reset flow is exercisable end-to-end without a real key.
 */

import { Resend } from 'resend';

const DEFAULT_FROM = 'HabitFlow <noreply@habitflow.ai>';

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(key);
  return cachedClient;
}

function getFrom(): string {
  return process.env.EMAIL_FROM ?? DEFAULT_FROM;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const client = getClient();
  if (!client) {
    console.info(`[email] RESEND_API_KEY not set — logging password reset URL for ${to}: ${resetUrl}`);
    return;
  }

  const subject = 'Reset your HabitFlow password';
  const text = [
    'You (or someone) requested a password reset for your HabitFlow account.',
    '',
    `Reset your password: ${resetUrl}`,
    '',
    'This link expires in 15 minutes and can only be used once.',
    'If you did not request this, you can safely ignore this email.',
  ].join('\n');
  const html = `
    <p>You (or someone) requested a password reset for your HabitFlow account.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p style="color:#666;font-size:14px;">This link expires in 15 minutes and can only be used once. If you did not request this, you can safely ignore this email.</p>
  `;

  try {
    await client.emails.send({
      from: getFrom(),
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    // Do not surface email failures to the caller — we still respond 200 so
    // that the endpoint cannot be used to enumerate accounts. Log for ops.
    console.error('[email] Failed to send password reset email', err);
  }
}
