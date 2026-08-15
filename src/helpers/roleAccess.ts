import type { Role } from '@/src/constants/roles';
import {
  canViewCeoDashboard,
  canViewUsers,
  isInvestor,
  isLineManager,
  isProjectOwner,
} from '@/src/helpers/guards';

/** Login portal the user chose on the sign-in page. */
export type AuthPortal = 'investor' | 'staff';

/** Tabs a role may open. Anything else is bounced to their home. */
const TAB_ACCESS: Record<string, (role: Role) => boolean> = {
  dashboard: (r) => canViewCeoDashboard(r),
  home: (r) => isInvestor(r) || isLineManager(r) || isProjectOwner(r),
  projects: (r) => canViewCeoDashboard(r) || isLineManager(r) || isProjectOwner(r),
  approvals: (r) => canViewCeoDashboard(r),
  tasks: (r) => canViewCeoDashboard(r) || isLineManager(r),
  portfolio: (r) => isInvestor(r),
  explore: (r) => isInvestor(r),
  messages: (r) => isInvestor(r) || isLineManager(r) || isProjectOwner(r),
  notifications: () => true,
  invitations: (r) => isInvestor(r),
  statements: (r) => isInvestor(r),
  earnings: (r) => isLineManager(r) || isProjectOwner(r),
  users: (r) => canViewUsers(r),
  profile: () => true,
};

export function roleCanAccessTab(role: Role | null, tabName: string | undefined): boolean {
  if (!role || !tabName) return false;
  const check = TAB_ACCESS[tabName];
  if (!check) return false;
  return check(role);
}

/** First path segment under (tabs), e.g. "dashboard" from ["(tabs)","dashboard"]. */
export function tabNameFromSegments(segments: readonly string[]): string | undefined {
  if (segments[0] !== '(tabs)') return undefined;
  return segments[1];
}

export function portalAllowsRole(portal: AuthPortal, role: Role | null): boolean {
  if (!role) return false;
  if (portal === 'investor') return isInvestor(role);
  // Staff portal: operators + project owners (never investors).
  return canViewCeoDashboard(role) || isLineManager(role) || isProjectOwner(role);
}

export function portalLabel(portal: AuthPortal): string {
  return portal === 'investor' ? 'Investor' : 'Staff';
}
