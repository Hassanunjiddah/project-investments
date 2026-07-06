import type {
  CeoDashboardStats,
  ManagerDashboardStats,
  InvestorDashboardStats,
} from '../types/dashboard';

export const CEO_DASHBOARD_STATS: CeoDashboardStats = {
  totalProjects: 12,
  projectsChange: '+ 2 new',
  capitalRaisedKobo: 182000000000,
  capitalChange: '↑ 18%',
  pendingApprovals: 7,
  approvalsChange: '↓ 2 from yesterday',
  totalInvestors: 31,
  investorsChange: '↑ 6 new',
};

export const MANAGER_DASHBOARD_STATS: ManagerDashboardStats = {
  totalProjects: 8,
  projectsChange: '+ 2 new',
  totalRaisedKobo: 426000000000,
  raisedChange: '↑ 18%',
  activeInvestors: 18,
  investorsChange: '↑ 6 new',
  projectedProfitKobo: 38000000000,
  profitChange: '↑ 12%',
};

export const INVESTOR_DASHBOARD_STATS: InvestorDashboardStats = {
  totalInvestedKobo: 42500000000,
  projectedProfitKobo: 6500000000,
  realisedProfitKobo: 2800000000,
  activeInvestments: 3,
  availableToWithdrawKobo: 0,
  portfolioRoiPct: 12.8,
};
