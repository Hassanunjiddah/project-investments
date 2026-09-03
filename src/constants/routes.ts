export const routes = {
  SIGN_IN: '/(auth)/sign-in',
  STAFF_SIGN_IN: '/(auth)/staff-sign-in',
  HOME: '/(tabs)/home',
  DASHBOARD: '/(tabs)/dashboard',
  APPROVALS: '/(tabs)/approvals',
  PROJECTS: '/projects',
  // Sibling tab (not nested under projects/) — nested stack blanked the
  // wizard on RN-web even though the route mounted.
  PROJECT_CREATE: '/project-create',
  /** Prefer `projectDetailHref(id)` — plain paths are more reliable on web. */
  PROJECT_DETAIL: '/projects/[id]',
  PROJECT_EDIT: '/projects/[id]/edit',
  INVITATIONS: '/(tabs)/invitations',
  INVITATION_DETAIL: '/(tabs)/invitations/[id]',
  PORTFOLIO: '/(tabs)/portfolio',
  EXPLORE: '/(tabs)/explore',
  TASKS: '/(tabs)/tasks',
  MESSAGES: '/(tabs)/messages',
  NOTIFICATIONS: '/(tabs)/notifications',
  EARNINGS: '/(tabs)/earnings',
  PROFILE: '/(tabs)/profile',
  USERS: '/(tabs)/users',
  USER_CREATE: '/(tabs)/users/create',
} as const;

/** Staff/CEO/LM/owner project detail — plain path for RN-web reliability. */
export function projectDetailPath(projectId: string, query?: string): string {
  const base = `/projects/${projectId}`;
  return query ? `${base}?${query}` : base;
}
