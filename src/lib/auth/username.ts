import { OPERATOR_EMAIL_DOMAIN, OPERATOR_USERNAMES } from '@/config/operators';

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${normaliseUsername(username)}@${OPERATOR_EMAIL_DOMAIN}`;
}

export function emailToUsername(email: string): string | null {
  const suffix = `@${OPERATOR_EMAIL_DOMAIN}`;
  const e = email.toLowerCase();
  return e.endsWith(suffix) ? e.slice(0, -suffix.length) : null;
}

export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const username = emailToUsername(email);
  return username !== null && OPERATOR_USERNAMES.includes(username);
}
