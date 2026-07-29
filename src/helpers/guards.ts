import type { Role } from '@/src/constants/roles';

export function isInvestor(role: Role | null): boolean {
  return role === 'INVESTOR';
}

export function canManageProjects(role: Role | null): boolean {
  return role === 'CEO' || role === 'ADMIN' || role === 'LINE_MANAGER';
}

export function canApproveProjects(role: Role | null): boolean {
  return role === 'CEO' || role === 'ADMIN';
}

export function canViewEarnings(role: Role | null): boolean {
  return role === 'CEO' || role === 'ADMIN' || role === 'LINE_MANAGER';
}

export function canCreateProject(role: Role | null): boolean {
  return role === 'LINE_MANAGER' || role === 'ADMIN';
}

export function canViewUsers(role: Role | null): boolean {
  return role === 'CEO' || role === 'ADMIN';
}

export function canViewCeoDashboard(role: Role | null): boolean {
  return role === 'CEO' || role === 'ADMIN';
}

export function isLineManager(role: Role | null): boolean {
  return role === 'LINE_MANAGER';
}

// Only the CEO provisions staff: they create Line Managers (who in turn
// invite investors to projects).
export function canCreateUsers(role: Role | null): boolean {
  return role === 'CEO';
}
