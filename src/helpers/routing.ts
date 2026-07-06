import type { Href } from 'expo-router';
import type { Role } from '@/src/constants/roles';
import { routes } from '@/src/constants/routes';
import { isInvestor, canViewCeoDashboard, isLineManager } from '@/src/helpers/guards';

export function getDefaultTabRoute(role: Role | null): Href {
  if (canViewCeoDashboard(role)) return routes.DASHBOARD;
  if (isLineManager(role)) return routes.HOME;
  if (isInvestor(role)) return routes.HOME;
  return routes.PROJECTS;
}
