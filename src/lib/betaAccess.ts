/**
 * Beta feature visibility.
 *
 * The Analytics and Insights pages are beta-gated to allowlisted emails. The
 * read-only public demo can also view them (real derived data, clearly labeled
 * Beta) so visitors see the full breadth of the product.
 */

import type { AuthUser } from '../store/AuthContext';
import { getActiveUserMode } from './persistenceClient';

const BETA_EMAILS = ['tj.galloway1@gmail.com'];

export function isBetaViewer(user: AuthUser | null): boolean {
  if (getActiveUserMode() === 'demo') return true;
  const email = user?.email?.toLowerCase();
  return !!email && BETA_EMAILS.includes(email);
}
