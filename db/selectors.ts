import type { ApprovalStatus, MockProject, MockProjectWithCreator } from './types/project';
import type { CeoDashboardStats, ManagerDashboardStats, InvestorDashboardStats } from './types/dashboard';
import type { PortfolioEntry, InvestmentStatus } from './types/investment';
import type { ManagerTask } from './types/task';
import type { PendingAction, ProjectUpdate } from './types/notification';
import type { ProjectDocument } from './types/document';
import type { MockUser } from './types/user';

import { MOCK_USERS, MOCK_USER_BY_ID, MOCK_USER_BY_ROLE } from './seed/users';
import { MOCK_PROJECTS, MOCK_PROJECT_BY_ID } from './seed/projects';
import { MOCK_INVESTMENTS } from './seed/investments';
import { MOCK_TASKS } from './seed/tasks';
import { MOCK_PENDING_ACTIONS, MOCK_PROJECT_UPDATES } from './seed/notifications';
import { CEO_DASHBOARD_STATS, MANAGER_DASHBOARD_STATS, INVESTOR_DASHBOARD_STATS } from './seed/stats';
import { MOCK_DOCUMENTS } from './seed/documents';

// Mutable in-memory state for local UI actions (approve/reject, etc.)
let projects = [...MOCK_PROJECTS];

export function resetMockDb() {
  projects = [...MOCK_PROJECTS];
}

export function getMockUserIdForRole(role: string | null): string {
  if (!role) return MOCK_USER_BY_ROLE.INVESTOR;
  return MOCK_USER_BY_ROLE[role] ?? MOCK_USER_BY_ROLE.INVESTOR;
}

export function getUserById(id: string): MockUser | undefined {
  return MOCK_USER_BY_ID[id];
}

export function getAllUsers(): MockUser[] {
  return MOCK_USERS;
}

function enrichProject(project: MockProject): MockProjectWithCreator {
  const creator = MOCK_USER_BY_ID[project.createdBy];
  return {
    ...project,
    creatorName: creator?.fullName ?? 'Unknown',
    creatorVerified: creator?.verified,
  };
}

export function getProjectById(id: string): MockProjectWithCreator | undefined {
  const project = projects.find((p) => p.id === id);
  return project ? enrichProject(project) : undefined;
}

export function getAllProjects(): MockProjectWithCreator[] {
  return projects.map(enrichProject);
}

export function updateProjectApprovalStatus(id: string, status: ApprovalStatus): void {
  projects = projects.map((p) => (p.id === id ? { ...p, approvalStatus: status } : p));
}

export type CeoDashboard = {
  stats: CeoDashboardStats;
  pendingApprovals: MockProjectWithCreator[];
  activeProjects: MockProjectWithCreator[];
};

export function getCeoDashboard(_userId?: string): CeoDashboard {
  const pending = projects
    .filter((p) => p.approvalStatus === 'PENDING')
    .map(enrichProject);
  const active = projects
    .filter(
      (p) =>
        p.approvalStatus === 'APPROVED' &&
        (p.stage === 'PROGRESS' || p.stage === 'ACCEPTANCE'),
    )
    .sort((a, b) => b.raisedKobo / b.targetKobo - a.raisedKobo / a.targetKobo)
    .map(enrichProject);

  const pendingCount = pending.length;

  return {
    stats: {
      ...CEO_DASHBOARD_STATS,
      pendingApprovals: pendingCount,
    },
    pendingApprovals: pending,
    activeProjects: active,
  };
}

export function getApprovalsByStatus(status: ApprovalStatus): MockProjectWithCreator[] {
  return projects.filter((p) => p.approvalStatus === status).map(enrichProject);
}

export type ManagerDashboard = {
  stats: ManagerDashboardStats;
  tasks: ManagerTask[];
  fundingOverview: MockProjectWithCreator[];
};

export function getManagerDashboard(userId: string): ManagerDashboard {
  const owned = projects.filter((p) => p.createdBy === userId).map(enrichProject);
  return {
    stats: MANAGER_DASHBOARD_STATS,
    tasks: MOCK_TASKS.filter((t) => t.managerId === userId),
    fundingOverview: owned.filter((p) => p.approvalStatus === 'APPROVED'),
  };
}

export function getManagerProjects(userId: string): MockProjectWithCreator[] {
  return projects.filter((p) => p.createdBy === userId).map(enrichProject);
}

export function getManagerTasks(userId: string): ManagerTask[] {
  return MOCK_TASKS.filter((t) => t.managerId === userId);
}

export type InvestorDashboard = {
  stats: InvestorDashboardStats;
  pendingActions: PendingAction[];
  recentUpdates: ProjectUpdate[];
};

export function getInvestorDashboard(userId: string): InvestorDashboard {
  return {
    stats: INVESTOR_DASHBOARD_STATS,
    pendingActions: MOCK_PENDING_ACTIONS.filter((a) => a.investorId === userId),
    recentUpdates: MOCK_PROJECT_UPDATES,
  };
}

export function getInvestorPortfolio(
  userId: string,
  filter: InvestmentStatus = 'active',
): (PortfolioEntry & { project: MockProjectWithCreator })[] {
  return MOCK_INVESTMENTS.filter((i) => i.investorId === userId && i.status === filter)
    .map((inv) => {
      const project = projects.find((p) => p.id === inv.projectId);
      return project ? { ...inv, project: enrichProject(project) } : null;
    })
    .filter((x): x is PortfolioEntry & { project: MockProjectWithCreator } => x !== null);
}

export type ExploreFilters = {
  query?: string;
  sector?: string;
};

export function getExploreProjects(filters?: ExploreFilters): MockProjectWithCreator[] {
  let result = projects.filter(
    (p) => p.approvalStatus === 'APPROVED' && p.stage !== 'END',
  );

  if (filters?.sector && filters.sector !== 'All') {
    result = result.filter((p) => p.sector.toLowerCase().includes(filters.sector!.toLowerCase()));
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sector.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q),
    );
  }

  return result.map(enrichProject);
}

export function getDocumentsForProject(projectId: string): ProjectDocument[] {
  return MOCK_DOCUMENTS.filter((d) => d.projectId === projectId);
}

export function getPendingApprovalCount(): number {
  return projects.filter((p) => p.approvalStatus === 'PENDING').length;
}

export function getFundingProgress(project: Pick<MockProject, 'targetKobo' | 'raisedKobo'>): number {
  if (project.targetKobo <= 0) return 0;
  return Math.min(100, Math.round((project.raisedKobo / project.targetKobo) * 100));
}

export function getDaysLeft(deadline?: string): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export const EXPLORE_SECTORS = ['All', 'Agriculture', 'Real Estate', 'Logistics', 'Energy'];
