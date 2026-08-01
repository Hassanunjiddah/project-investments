import type { Href } from 'expo-router';
import type { Role } from '@/src/constants/roles';
import { routes } from '@/src/constants/routes';
import { isInvestor, canViewCeoDashboard, isLineManager } from '@/src/helpers/guards';

export function getDefaultTabRoute(role: Role | null): Href {
  if (canViewCeoDashboard(role)) return routes.DASHBOARD;
  if (isLineManager(role)) return routes.HOME;
  if (isInvestor(role)) return routes.HOME;
  // Unknown / still-hydrating role — never send users to Projects (LM-only).
  // HomeScreen itself waits for a concrete role before rendering a shell.
  return routes.HOME;
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
  return `/(tabs)/projects/${projectId}?${params.toString()}` as Href;
}
