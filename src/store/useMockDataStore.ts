import { create } from 'zustand';
import {
  getCeoDashboard,
  getApprovalsByStatus,
  getManagerDashboard,
  getManagerProjects,
  getInvestorDashboard,
  getInvestorPortfolio,
  getExploreProjects,
  getProjectById,
  getDocumentsForProject,
  getPendingApprovalCount,
  getManagerTasks,
  getAllProjects,
  updateProjectApprovalStatus,
  type ExploreFilters,
} from '@/db/selectors';
import type { ApprovalStatus, InvestmentStatus } from '@/db';

type MockDataStore = {
  version: number;
  refresh: () => void;
  approveProject: (id: string) => void;
  rejectProject: (id: string) => void;
  getCeoDashboard: typeof getCeoDashboard;
  getApprovalsByStatus: (status: ApprovalStatus) => ReturnType<typeof getApprovalsByStatus>;
  getManagerDashboard: typeof getManagerDashboard;
  getManagerProjects: typeof getManagerProjects;
  getInvestorDashboard: typeof getInvestorDashboard;
  getInvestorPortfolio: (userId: string, filter?: InvestmentStatus) => ReturnType<typeof getInvestorPortfolio>;
  getExploreProjects: (filters?: ExploreFilters) => ReturnType<typeof getExploreProjects>;
  getProjectById: typeof getProjectById;
  getDocumentsForProject: typeof getDocumentsForProject;
  getPendingApprovalCount: typeof getPendingApprovalCount;
  getManagerTasks: typeof getManagerTasks;
  getAllProjects: typeof getAllProjects;
};

export const useMockDataStore = create<MockDataStore>((set) => ({
  version: 0,
  refresh: () => set((s) => ({ version: s.version + 1 })),
  approveProject: (id) => {
    updateProjectApprovalStatus(id, 'APPROVED');
    set((s) => ({ version: s.version + 1 }));
  },
  rejectProject: (id) => {
    updateProjectApprovalStatus(id, 'REJECTED');
    set((s) => ({ version: s.version + 1 }));
  },
  getCeoDashboard,
  getApprovalsByStatus: (status) => getApprovalsByStatus(status),
  getManagerDashboard,
  getManagerProjects,
  getInvestorDashboard,
  getInvestorPortfolio: (userId, filter) => getInvestorPortfolio(userId, filter),
  getExploreProjects,
  getProjectById,
  getDocumentsForProject,
  getPendingApprovalCount,
  getManagerTasks,
  getAllProjects,
}));
