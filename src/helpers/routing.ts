import type { Href } from 'expo-router';
import type { Role } from '@/src/constants/roles';
import { routes } from '@/src/constants/routes';
import { isInvestor } from '@/src/helpers/guards';

export function getDefaultTabRoute(role: Role | null): Href {
  if (isInvestor(role)) return routes.INVITATIONS;
  return routes.PROJECTS;
}
