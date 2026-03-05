/**
 * Auth validation: email format, password minimum.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: unknown): { valid: boolean; error?: string } {
  if (email == null || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required.' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid email format.' };
  }
  return { valid: true };
}

export function validatePassword(password: unknown): { valid: boolean; error?: string } {
  if (password == null || typeof password !== 'string') {
    return { valid: false, error: 'Password is required.' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { valid: true };
}

export function validateDisplayName(displayName: unknown): { valid: boolean; error?: string } {
  if (displayName != null && typeof displayName !== 'string') {
    return { valid: false, error: 'Display name must be a string.' };
  }
  return { valid: true };
}

export function validateInviteCode(inviteCode: unknown): { valid: boolean; error?: string } {
  if (inviteCode == null || typeof inviteCode !== 'string') {
    return { valid: false, error: 'Invite code is required.' };
  }
  const trimmed = inviteCode.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Invite code is required.' };
  }
  return { valid: true };
}
