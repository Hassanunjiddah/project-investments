export const routes = {
  SIGN_IN: '/(auth)/sign-in',
  PROJECTS: '/(tabs)/projects',
  PROJECT_CREATE: '/(tabs)/projects/create',
  PROJECT_DETAIL: '/(tabs)/projects/[id]',
  PROJECT_EDIT: '/(tabs)/projects/[id]/edit',
  INVITATIONS: '/(tabs)/invitations',
  INVITATION_DETAIL: '/(tabs)/invitations/[id]',
  PORTFOLIO: '/(tabs)/portfolio',
  EARNINGS: '/(tabs)/earnings',
  PROFILE: '/(tabs)/profile',
  USERS: '/(tabs)/users',
  USER_CREATE: '/(tabs)/users/create',
} as const;
