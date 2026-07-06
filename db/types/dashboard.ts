export type CeoDashboardStats = {
  totalProjects: number;
  projectsChange: string;
  capitalRaisedKobo: number;
  capitalChange: string;
  pendingApprovals: number;
  approvalsChange: string;
  totalInvestors: number;
  investorsChange: string;
};

export type ManagerDashboardStats = {
  totalProjects: number;
  projectsChange: string;
  totalRaisedKobo: number;
  raisedChange: string;
  activeInvestors: number;
  investorsChange: string;
  projectedProfitKobo: number;
  profitChange: string;
};

export type InvestorDashboardStats = {
  totalInvestedKobo: number;
  projectedProfitKobo: number;
  realisedProfitKobo: number;
  activeInvestments: number;
  availableToWithdrawKobo: number;
  portfolioRoiPct: number;
};
