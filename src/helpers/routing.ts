import type { Href } from 'expo-router';
import type { Role } from '@/src/constants/roles';
import {
  isInvestor,
  canViewCeoDashboard,
  isLineManager,
  isProjectOwner,
} from '@/src/helpers/guards';

export function getDefaultTabRoute(role: Role | null): Href {
  // Plain paths — more reliable on web after sign-in/out.
  if (canViewCeoDashboard(role)) return '/dashboard' as Href;
  if (isLineManager(role) || isProjectOwner(role)) return '/home' as Href;
  if (isInvestor(role)) return '/home' as Href;
  // Unknown role — never send to CEO/LM-only routes.
  return '/home' as Href;
}

/** Investor-safe project deep link (portfolio stack, not LM projects tab). */
export function investorProjectHref(projectId: string, inviteId?: string): Href {
  const base = `/(tabs)/portfolio/projects/${projectId}`;
  return (inviteId ? `${base}?invite=${encodeURIComponent(inviteId)}` : base) as Href;
}

/** LM deep link straight to the Investors tab to confirm a proof. */
export function managerConfirmProofHref(projectId: string, inviteId?: string): Href {
  const params = new URLSearchParams({ tab: 'investors' });
  if (inviteId) params.set('invite', inviteId);
  return `/projects/${projectId}?${params.toString()}` as Href;
}
