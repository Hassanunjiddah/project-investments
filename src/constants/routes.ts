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
  PROJECT_DETAIL: '/(tabs)/projects/[id]',
  PROJECT_EDIT: '/(tabs)/projects/[id]/edit',
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
