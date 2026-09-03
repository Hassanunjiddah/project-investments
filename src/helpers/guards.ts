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
  // Matches create-project edge: LINE_MANAGER, CEO, ADMIN.
  return role === 'LINE_MANAGER' || role === 'CEO' || role === 'ADMIN';
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

export function isProjectOwner(role: Role | null): boolean {
  return role === 'PROJECT_OWNER';
}

/** Prism staff (LM) or CEO — operate the raise. */
export function isPrismOperator(role: Role | null): boolean {
  return role === 'LINE_MANAGER' || role === 'CEO' || role === 'ADMIN';
}

// Only the CEO provisions staff: they create Line Managers (who in turn
// invite investors to projects). ADMIN matches CEO on dashboard / approvals /
// ledger visibility, but cannot create users.
export function canCreateUsers(role: Role | null): boolean {
  return role === 'CEO';
}

/** Prism LM/CEO can provision a project owner onto a project. */
export function canAssignProjectOwner(role: Role | null): boolean {
  return role === 'LINE_MANAGER' || role === 'CEO' || role === 'ADMIN';
}
