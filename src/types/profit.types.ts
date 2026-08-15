export type ProfitUpdate = {
  id: string;
  projectId: string;
  amountMinor: number;
  note: string;
  postedBy: string;
  postedByName?: string;
  createdAt: string;
};

export type InvestorProjectProfit = {
  projectId: string;
  inviteId: string;
  capitalMinor: number;
  realisedProfitMinor: number; // project-level total
  investorShareMinor: number; // this investor's share
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  projectName: string;
};

export type ManagerProfitSummary = {
  totalRealisedProfitMinor: number;
  /** Prism platform fees earned on approved declarations (LM earnings). */
  platformFeeMinor: number;
  /** @deprecated alias of platformFeeMinor for older callers */
  managerShareMinor: number;
  projectCount: number;
};

export type OwnerProfitSummary = {
  totalRealisedProfitMinor: number;
  /** Originator manager share from approved declarations. */
  managerShareMinor: number;
  projectCount: number;
};

export type EarningBreakdownRow = {
  projectId: string;
  projectCode: string;
  projectName: string;
  grossMinor: number;
  amountMinor: number;
  declarationCount: number;
};

export type InvestorPayout = {
  id: string;
  projectId: string;
  inviteId: string;
  investorId: string;
  capitalMinor: number;
  profitMinor: number;
  paidAt?: string;
  createdAt: string;
};
