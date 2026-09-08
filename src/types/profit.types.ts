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
  /** Combined Prism fees (raise + profit). */
  platformFeeMinor: number;
  /** @deprecated alias of platformFeeMinor for older callers */
  managerShareMinor: number;
  /** Accrued Prism raise fee across the LM's projects. */
  raiseFeeMinor: number;
  /** Prism profit (declaration) fee across approved declarations. */
  profitFeeMinor: number;
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
  /** Combined earning for this project (raise + profit, or owner manager share). */
  amountMinor: number;
  declarationCount: number;
  raiseFeeMinor: number;
  profitFeeMinor: number;
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
